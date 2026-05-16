import { z } from "zod";
import type {
  AiInsightSourceSummary,
  AiTasteProfile,
  Movie,
  MovieActivity,
  SeasonProgress,
  TvShow,
  UserMovieList,
  UserWatchlist,
} from "@shared/schema";
import { createNvidiaChatCompletion, isLlmClientError, type LlmChatMessage } from "./llm-client";
import { storage } from "./storage";

export const TV_TASTE_PROFILE_PROMPT_VERSION = "tv-taste-profile-v8";
export const MOVIE_TASTE_PROFILE_PROMPT_VERSION = "movie-taste-profile-v6";

type ConfidenceTier = "no_signal" | "very_limited_signal" | "limited_signal" | "healthy_signal";

type EvaluationContext = {
  confidenceTier: ConfidenceTier;
  usableItemCount: number;
  datedActivityCount: number;
  genreCount: number;
  ratedItemCount: number;
  hasOnlyRecentDates: boolean;
  hasOnlyOldDates: boolean;
  hasMissingMetadata: boolean;
  hasNarrowGenreHistory: boolean;
  hasConflictingRatingsOrOutliers: boolean;
  recommendedCaveat: string;
};

type WatchlistWithActivity = UserWatchlist & {
  show: TvShow;
  lastActivity: string | null;
  seasons: SeasonProgress[];
};

type ShowPromptItem = {
  title: string;
  years: string;
  genre: string | null;
  showRating: string | null;
  description: string | null;
  watchedSeasons: number[];
  seasonDetails: Array<{
    seasonNumber: number;
    startDate: string | null;
    finishDate: string | null;
    rating: number | null;
  }>;
  activeYears: string[];
  averageRating: number | null;
  ratedSeasons: number;
  lastActivity: string | null;
};

type MovieListWithActivity = UserMovieList & {
  movie: Movie;
  activity: MovieActivity | null;
};

type MoviePromptItem = {
  title: string;
  releaseYear: string;
  genre: string | null;
  contentRating: string | null;
  description: string | null;
  userRating: number | null;
  watchedDate: string | null;
  watchedUsing: string | null;
  dateAdded: string | null;
  isWatched: boolean;
};

export type AiGenerationStage =
  | "config"
  | "provider_request"
  | "provider_http"
  | "provider_response"
  | "observability_log"
  | "profile_parse"
  | "profile_validation";

type AiGenerationErrorInput = {
  stage: AiGenerationStage;
  provider?: string;
  model?: string;
  upstreamStatus?: number;
  upstreamBody?: string;
  isProviderUnavailable?: boolean;
  cause?: unknown;
};

export class AiGenerationError extends Error {
  stage: AiGenerationStage;
  provider?: string;
  model?: string;
  upstreamStatus?: number;
  upstreamBody?: string;
  isProviderUnavailable: boolean;
  originalError?: unknown;

  constructor(message: string, input: AiGenerationErrorInput) {
    super(message);
    this.name = "AiGenerationError";
    this.stage = input.stage;
    this.provider = input.provider;
    this.model = input.model;
    this.upstreamStatus = input.upstreamStatus;
    this.upstreamBody = input.upstreamBody;
    this.isProviderUnavailable = input.isProviderUnavailable ?? false;
    this.originalError = input.cause;
  }
}

export function isAiGenerationError(error: unknown): error is AiGenerationError {
  return error instanceof AiGenerationError;
}

export class AiInsufficientSignalError extends Error {
  code = "AI_INSUFFICIENT_SIGNAL" as const;
  mediaType: "tv" | "movie";

  constructor(mediaType: "tv" | "movie", message: string) {
    super(message);
    this.name = "AiInsufficientSignalError";
    this.mediaType = mediaType;
  }
}

export function isAiInsufficientSignalError(error: unknown): error is AiInsufficientSignalError {
  return error instanceof AiInsufficientSignalError;
}

const tasteProfileSchema = z.object({
  tasteSummary: z.string().min(1),
  topGenres: z.array(z.string()).default([]),
  favoritePatterns: z.array(z.string()).max(5).default([]),
  recentTrends: z.array(z.string()).optional(),
  discoveryLanes: z.array(z.string()).max(5).default([]),
  tasteArchetype: z.object({
    primary: z.string().min(1),
    secondary: z.array(z.string().min(1)).min(2).max(4),
    avoidancePattern: z.string().min(1),
    recommendationNorthStar: z.string().min(1),
  }).nullable().optional(),
});

const RECENT_ACTIVITY_WINDOW_DAYS = 90;
const OLD_ACTIVITY_THRESHOLD_DAYS = 365;
const CONFLICTING_RATING_SPREAD = 40;
const MAX_PROFILE_GENERATION_RETRIES = 2;
const PROFILE_STRING_ARRAY_FIELDS = [
  "topGenres",
  "favoritePatterns",
  "recentTrends",
  "discoveryLanes",
  "secondary",
];

function normalizeDate(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function getWatchedSeasonNumbers(seasons: SeasonProgress[]) {
  return seasons
    .filter((season) => season.startDate || season.finishDate)
    .map((season) => season.seasonNumber)
    .sort((a, b) => a - b);
}

function getSeasonDetails(seasons: SeasonProgress[]) {
  return seasons
    .filter((season) => season.startDate || season.finishDate || season.rating != null)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((season) => ({
      seasonNumber: season.seasonNumber,
      startDate: normalizeDate(season.startDate),
      finishDate: normalizeDate(season.finishDate),
      rating: season.rating ?? null,
    }));
}

function getActiveYears(seasons: SeasonProgress[]) {
  const years = new Set<string>();

  for (const season of seasons) {
    const startDate = normalizeDate(season.startDate);
    const finishDate = normalizeDate(season.finishDate);
    if (startDate) years.add(startDate.slice(0, 4));
    if (finishDate) years.add(finishDate.slice(0, 4));
  }

  return Array.from(years).sort();
}

function calculateAverageRating(seasons: SeasonProgress[]) {
  const ratings = seasons
    .map((season) => season.rating)
    .filter((rating): rating is number => rating != null);

  if (ratings.length === 0) return null;
  return Math.round(ratings.reduce((total, rating) => total + rating, 0) / ratings.length);
}

function splitGenres(genre: string | null) {
  if (!genre) return [];
  return genre
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGenreKey(genre: string) {
  return genre.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function isUsableTvItem(item: ShowPromptItem) {
  return item.watchedSeasons.length > 0 || item.ratedSeasons > 0;
}

function isUsableMovieItem(item: MoviePromptItem) {
  return item.isWatched || item.userRating != null;
}

function getSourceGenreRanking<T>(
  items: T[],
  getGenre: (item: T) => string | null,
  isUsable: (item: T) => boolean
) {
  const genreStats = new Map<string, { genre: string; count: number; firstIndex: number }>();

  items.forEach((item, itemIndex) => {
    if (!isUsable(item)) return;

    for (const genre of splitGenres(getGenre(item))) {
      const key = normalizeGenreKey(genre);
      if (!key) continue;

      const existing = genreStats.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        genreStats.set(key, {
          genre: genre.trim().replace(/\s+/g, " "),
          count: 1,
          firstIndex: itemIndex,
        });
      }
    }
  });

  return Array.from(genreStats.values())
    .sort((left, right) => right.count - left.count || left.firstIndex - right.firstIndex)
    .map((item) => item.genre);
}

function applySourceTopGenreConstraint(profile: AiTasteProfile, allowedTopGenres: string[]): AiTasteProfile {
  if (allowedTopGenres.length === 0) {
    return {
      ...profile,
      topGenres: [],
    };
  }

  const genreByKey = new Map(allowedTopGenres.map((genre) => [normalizeGenreKey(genre), genre]));
  const selectedKeys = new Set<string>();
  const topGenres: string[] = [];

  for (const genre of profile.topGenres) {
    const key = normalizeGenreKey(genre);
    const allowedGenre = genreByKey.get(key);
    if (!allowedGenre || selectedKeys.has(key)) continue;

    selectedKeys.add(key);
    topGenres.push(allowedGenre);
    if (topGenres.length >= 6) break;
  }

  const minimumGenreCount = Math.min(3, allowedTopGenres.length);
  for (const genre of allowedTopGenres) {
    if (topGenres.length >= minimumGenreCount) break;

    const key = normalizeGenreKey(genre);
    if (selectedKeys.has(key)) continue;

    selectedKeys.add(key);
    topGenres.push(genre);
  }

  return {
    ...profile,
    topGenres,
  };
}

function getConfidenceTier(usableItemCount: number): ConfidenceTier {
  if (usableItemCount === 0) return "no_signal";
  if (usableItemCount <= 3) return "very_limited_signal";
  if (usableItemCount <= 7) return "limited_signal";
  return "healthy_signal";
}

function getRecommendedCaveat(confidenceTier: ConfidenceTier) {
  switch (confidenceTier) {
    case "no_signal":
      return "Do not generate a taste profile. Ask the user to add watched or rated history first.";
    case "very_limited_signal":
      return "Frame this as an early read based on limited watched or rated history.";
    case "limited_signal":
      return "Describe visible patterns without sweeping claims.";
    case "healthy_signal":
      return "Make firmer taste claims when supported, while staying grounded in supplied data.";
  }
}

function getDateFlags(dates: string[]) {
  const validDates = dates
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (validDates.length === 0) {
    return {
      hasOnlyRecentDates: false,
      hasOnlyOldDates: false,
    };
  }

  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  const agesInDays = validDates.map((date) => (now - date.getTime()) / dayInMs);

  return {
    hasOnlyRecentDates: agesInDays.every((age) => age >= 0 && age <= RECENT_ACTIVITY_WINDOW_DAYS),
    hasOnlyOldDates: agesInDays.every((age) => age > OLD_ACTIVITY_THRESHOLD_DAYS),
  };
}

function hasConflictingRatingsOrOutliers(ratings: number[]) {
  if (ratings.length < 3) return false;
  return Math.max(...ratings) - Math.min(...ratings) >= CONFLICTING_RATING_SPREAD;
}

function buildTvEvaluationContext(items: ShowPromptItem[]): EvaluationContext {
  const usableItemCount = items.filter(isUsableTvItem).length;
  const datedActivity = items.map((item) => item.lastActivity).filter((date): date is string => Boolean(date));
  const genreCount = new Set(items.flatMap((item) => splitGenres(item.genre))).size;
  const ratedItemCount = items.reduce((total, item) => total + item.ratedSeasons, 0);
  const confidenceTier = getConfidenceTier(usableItemCount);
  const ratings = items.flatMap((item) => item.seasonDetails)
    .map((season) => season.rating)
    .filter((rating): rating is number => rating != null);
  const dateFlags = getDateFlags(datedActivity);

  return {
    confidenceTier,
    usableItemCount,
    datedActivityCount: datedActivity.length,
    genreCount,
    ratedItemCount,
    ...dateFlags,
    hasMissingMetadata: items.some((item) => !item.genre || !item.description),
    hasNarrowGenreHistory: usableItemCount >= 2 && genreCount <= 1,
    hasConflictingRatingsOrOutliers: hasConflictingRatingsOrOutliers(ratings),
    recommendedCaveat: getRecommendedCaveat(confidenceTier),
  };
}

function buildMovieEvaluationContext(items: MoviePromptItem[]): EvaluationContext {
  const usableItemCount = items.filter(isUsableMovieItem).length;
  const datedActivity = items.map((item) => item.watchedDate).filter((date): date is string => Boolean(date));
  const genreCount = new Set(items.flatMap((item) => splitGenres(item.genre))).size;
  const ratings = items
    .map((item) => item.userRating)
    .filter((rating): rating is number => rating != null);
  const confidenceTier = getConfidenceTier(usableItemCount);
  const dateFlags = getDateFlags(datedActivity);

  return {
    confidenceTier,
    usableItemCount,
    datedActivityCount: datedActivity.length,
    genreCount,
    ratedItemCount: ratings.length,
    ...dateFlags,
    hasMissingMetadata: items.some((item) => !item.genre || !item.description),
    hasNarrowGenreHistory: usableItemCount >= 2 && genreCount <= 1,
    hasConflictingRatingsOrOutliers: hasConflictingRatingsOrOutliers(ratings),
    recommendedCaveat: getRecommendedCaveat(confidenceTier),
  };
}

const sharedEvaluationGuidance = [
  "Use evaluationContext to calibrate confidence. If confidenceTier is very_limited_signal, make the tasteSummary explicitly provisional. If confidenceTier is limited_signal, describe visible patterns without sweeping claims. If confidenceTier is healthy_signal, you may make firmer claims while staying grounded in the supplied data.",
  "Apply evaluationContext.recommendedCaveat directly when shaping tasteSummary.",
  "Do not infer strong preferences from items that were only added to the list but not watched or rated.",
  "If hasNarrowGenreHistory is true, describe the focus without pretending breadth.",
  "If hasConflictingRatingsOrOutliers is true, avoid letting one title or rating define the whole profile; describe contrast when useful.",
  "If hasMissingMetadata is true, make conservative claims from available titles, descriptions, ratings, dates, and activity.",
  "Return empty arrays when a section is unsupported rather than filling space.",
  "Only include recentTrends when dated activity supports a meaningful before/after shift. If dates are missing, sparse, only recent, or only old, return an empty recentTrends array.",
  "If hasOnlyOldDates is true, avoid current-taste language and frame the profile as based on historical activity.",
];

const sharedTitleSafeSummaryGuidance = [
  "Use supplied titles as private evidence only; do not include exact TV show or movie titles in tasteSummary.",
  "In tasteSummary, generalize titles into traits, such as morally gray serialized dramas, character-led workplace comedy, or high-concept speculative mystery.",
  "In tasteSummary, do not write examples like such as, including, or like followed by supplied titles.",
  "This no-title rule applies only to tasteSummary. Other profile fields should follow their own instructions.",
];

const sharedJsonGuidance = [
  "Return one JSON object only. Do not include Markdown, prose before or after JSON, comments, or trailing commas.",
  "Every array item must be a valid quoted JSON string. This includes topGenres, favoritePatterns, recentTrends, discoveryLanes, and tasteArchetype.secondary.",
  "Never put bare words or unquoted phrases inside arrays. Write [\"Ensemble-driven storytelling\"] instead of [Ensemble-driven storytelling].",
];

const sharedArchetypeGuidance = [
  "Only include tasteArchetype when evaluationContext.confidenceTier is healthy_signal.",
  "If confidenceTier is no_signal, very_limited_signal, or limited_signal, return tasteArchetype as null.",
  "The archetype must be inferred only from supplied watched/rated history and supported metadata.",
  "Do not invent titles, genres, themes, platforms, or ratings to justify an archetype.",
  "Make archetype labels specific, compact, and recommendation-useful, not generic personality labels.",
  "Primary archetype should be one vivid phrase that summarizes the strongest supported taste pattern.",
  "Secondary archetypes should contain 2 to 4 shorter labels for distinct supporting patterns.",
  "Avoidance pattern should describe traits the user likely avoids, only when supported by low ratings, dropped/unfinished activity, or clear contrast with liked history.",
  "If avoidance evidence is indirect, phrase it cautiously.",
  "Recommendation north star should explain what future recommendations should optimize for in one sentence.",
  "Do not repeat the same idea across primary, secondary, avoidancePattern, and recommendationNorthStar.",
];

function buildTvSourceSummary(items: ShowPromptItem[]): AiInsightSourceSummary {
  const ratings = items
    .map((item) => item.averageRating)
    .filter((rating): rating is number => rating != null);
  const genres = new Set(items.flatMap((item) => splitGenres(item.genre)));
  const dates = items
    .map((item) => item.lastActivity)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    showCount: items.length,
    watchedSeasonCount: items.reduce((total, item) => total + item.watchedSeasons.length, 0),
    ratedSeasonCount: items.reduce((total, item) => total + item.ratedSeasons, 0),
    averageRating: ratings.length > 0
      ? Math.round(ratings.reduce((total, rating) => total + rating, 0) / ratings.length)
      : null,
    genreCount: genres.size,
    dateRange: {
      start: dates[0] ?? null,
      end: dates[dates.length - 1] ?? null,
    },
  };
}

function buildPromptItems(watchlist: WatchlistWithActivity[]): ShowPromptItem[] {
  return watchlist.map((item) => {
    const averageRating = calculateAverageRating(item.seasons);
    const ratedSeasons = item.seasons.filter((season) => season.rating != null).length;
    const years = item.show.year_end
      ? `${item.show.year_start}-${item.show.year_end}`
      : `${item.show.year_start}-present`;

    return {
      title: item.show.title,
      years,
      genre: item.show.genre,
      showRating: item.show.rating,
      description: item.show.description,
      watchedSeasons: getWatchedSeasonNumbers(item.seasons),
      seasonDetails: getSeasonDetails(item.seasons),
      activeYears: getActiveYears(item.seasons),
      averageRating,
      ratedSeasons,
      lastActivity: normalizeDate(item.lastActivity),
    };
  });
}

function calculateAverageMovieRating(items: MoviePromptItem[]) {
  const ratings = items
    .map((item) => item.userRating)
    .filter((rating): rating is number => rating != null);

  if (ratings.length === 0) return null;
  return Math.round(ratings.reduce((total, rating) => total + rating, 0) / ratings.length);
}

function buildMovieSourceSummary(items: MoviePromptItem[]): AiInsightSourceSummary {
  const genres = new Set(items.flatMap((item) => splitGenres(item.genre)));
  const dates = items
    .map((item) => item.watchedDate)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    movieCount: items.length,
    watchedMovieCount: items.filter((item) => item.isWatched).length,
    ratedMovieCount: items.filter((item) => item.userRating != null).length,
    averageRating: calculateAverageMovieRating(items),
    genreCount: genres.size,
    dateRange: {
      start: dates[0] ?? null,
      end: dates[dates.length - 1] ?? null,
    },
  };
}

function buildMoviePromptItems(movieList: MovieListWithActivity[]): MoviePromptItem[] {
  return movieList.map((item) => ({
    title: item.movie.title,
    releaseYear: item.movie.release_year,
    genre: item.movie.genre,
    contentRating: item.movie.rating,
    description: item.movie.description,
    userRating: item.activity?.rating ?? null,
    watchedDate: normalizeDate(item.activity?.dateWatched),
    watchedUsing: item.activity?.watchedUsing ?? null,
    dateAdded: normalizeDate(item.dateAdded),
    isWatched: Boolean(item.activity?.dateWatched),
  }));
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new AiGenerationError("The AI response did not include a JSON object.", {
    stage: "profile_parse",
    provider: "nvidia",
  });
}

function findArrayCloseIndex(json: string, openBracketIndex: number) {
  let inString = false;
  let escaped = false;

  for (let index = openBracketIndex + 1; index < json.length; index += 1) {
    const char = json[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "]") {
      return index;
    }
  }

  return -1;
}

function splitArrayItems(arrayContent: string) {
  const items: string[] = [];
  let itemStart = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < arrayContent.length; index += 1) {
    const char = arrayContent[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === ",") {
      items.push(arrayContent.slice(itemStart, index));
      itemStart = index + 1;
    }
  }

  items.push(arrayContent.slice(itemStart));
  return items;
}

function repairStringArrayItem(item: string) {
  const value = item.trim();
  if (!value || value.startsWith("\"")) {
    return item;
  }

  if (
    value.startsWith("{")
    || value.startsWith("[")
    || value.includes(":")
    || /^(true|false|null)$/i.test(value)
    || /^-?\d+(?:\.\d+)?$/.test(value)
  ) {
    return item;
  }

  const leadingWhitespace = item.match(/^\s*/)?.[0] ?? "";
  const trailingWhitespace = item.match(/\s*$/)?.[0] ?? "";
  return `${leadingWhitespace}${JSON.stringify(value)}${trailingWhitespace}`;
}

function repairStringArrayContent(arrayContent: string) {
  const items = splitArrayItems(arrayContent);
  let changed = false;
  const repairedItems = items.map((item) => {
    const repairedItem = repairStringArrayItem(item);
    if (repairedItem !== item) {
      changed = true;
    }
    return repairedItem;
  });

  return changed ? repairedItems.join(",") : null;
}

export function repairKnownProfileStringArrays(json: string) {
  let repairedJson = json;
  let changed = false;

  for (const field of PROFILE_STRING_ARRAY_FIELDS) {
    const fieldPattern = new RegExp(`"${field}"\\s*:\\s*\\[`, "g");
    let match: RegExpExecArray | null;

    while ((match = fieldPattern.exec(repairedJson)) !== null) {
      const openBracketIndex = match.index + match[0].lastIndexOf("[");
      const closeBracketIndex = findArrayCloseIndex(repairedJson, openBracketIndex);
      if (closeBracketIndex === -1) {
        break;
      }

      const arrayContent = repairedJson.slice(openBracketIndex + 1, closeBracketIndex);
      const repairedContent = repairStringArrayContent(arrayContent);
      if (!repairedContent) {
        fieldPattern.lastIndex = closeBracketIndex + 1;
        continue;
      }

      repairedJson = [
        repairedJson.slice(0, openBracketIndex + 1),
        repairedContent,
        repairedJson.slice(closeBracketIndex),
      ].join("");
      changed = true;
      fieldPattern.lastIndex = openBracketIndex + 1 + repairedContent.length + 1;
    }
  }

  return changed ? repairedJson : null;
}

export function parseTasteProfileJsonContent(content: string) {
  const json = extractJsonObject(content);

  try {
    return JSON.parse(json);
  } catch (strictParseError) {
    const repairedJson = repairKnownProfileStringArrays(json);
    if (!repairedJson) {
      throw strictParseError;
    }

    return JSON.parse(repairedJson);
  }
}

function applyArchetypeGate(profile: AiTasteProfile, evaluationContext: EvaluationContext): AiTasteProfile {
  if (evaluationContext.confidenceTier === "healthy_signal") {
    return profile;
  }

  return {
    ...profile,
    tasteArchetype: null,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTitleMentionRegex(title: string) {
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  if (!normalizedTitle) return null;

  const pattern = escapeRegExp(normalizedTitle).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${pattern}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

export function findTasteSummaryTitleMention(tasteSummary: string, titles: string[]) {
  const uniqueTitles = Array.from(new Set(titles.map((title) => title.trim()).filter(Boolean)));

  for (const title of uniqueTitles) {
    const titleRegex = getTitleMentionRegex(title);
    if (titleRegex?.test(tasteSummary)) {
      return title;
    }
  }

  return null;
}

function validateTasteSummaryHasNoTitles(profile: AiTasteProfile, titles: string[]) {
  return findTasteSummaryTitleMention(profile.tasteSummary, titles);
}

export function parseAndValidateTasteProfileContent(content: string, titles: string[], model?: string) {
  let parsed: unknown;
  try {
    parsed = parseTasteProfileJsonContent(content);
  } catch (error) {
    if (isAiGenerationError(error)) {
      error.model = model;
      error.upstreamBody = content;
      throw error;
    }

    throw new AiGenerationError("NVIDIA generation returned invalid profile JSON.", {
      stage: "profile_parse",
      provider: "nvidia",
      model,
      upstreamBody: content,
      cause: error,
    });
  }

  let profile: AiTasteProfile;
  try {
    profile = tasteProfileSchema.parse(parsed);
  } catch (error) {
    throw new AiGenerationError("NVIDIA generation returned a profile with an invalid schema.", {
      stage: "profile_validation",
      provider: "nvidia",
      model,
      upstreamBody: content,
      cause: error,
    });
  }

  const titleMention = validateTasteSummaryHasNoTitles(profile, titles);
  if (titleMention) {
    throw new AiGenerationError("NVIDIA generation returned a taste summary that names a supplied title.", {
      stage: "profile_validation",
      provider: "nvidia",
      model,
      upstreamBody: content,
      cause: new Error(`tasteSummary included supplied title: ${titleMention}`),
    });
  }

  return profile;
}

async function markObservedCallFailed(logId: number | null, error: AiGenerationError) {
  if (logId === null) return;

  try {
    await storage.markLlmCallLogFailed(logId, {
      errorStage: error.stage,
      errorMessage: error.message,
      errorBody: error.upstreamBody,
    });
  } catch (logError) {
    console.error("Failed to mark LLM observability log as failed", {
      logId,
      error: logError,
    });
  }
}

function getRetryMessages(input: {
  systemPrompt: string;
  userPrompt: string;
  attempt: number;
  previousError: AiGenerationError | null;
}): LlmChatMessage[] {
  const messages: LlmChatMessage[] = [
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userPrompt },
  ];

  if (input.attempt === 0) {
    return messages;
  }

  messages.push({
    role: "assistant",
    content: "The previous response was rejected and was not saved because it was not valid profile JSON.",
  });
  messages.push({
    role: "user",
    content: [
      `Retry ${input.attempt} of ${MAX_PROFILE_GENERATION_RETRIES}.`,
      "Return only one valid JSON object matching the requested schema.",
      "All string array items must be quoted JSON strings, with no bare words, no Markdown, no comments, and no trailing commas.",
      "Keep tasteSummary free of exact supplied TV show or movie titles.",
      input.previousError ? `Previous validation stage: ${input.previousError.stage}.` : null,
    ].filter(Boolean).join(" "),
  });

  return messages;
}

function shouldRetryProfileOutput(error: AiGenerationError) {
  return error.stage === "profile_parse" || error.stage === "profile_validation";
}

async function generateTasteProfileFromPrompt(input: {
  userId: number;
  operation: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  blockedSummaryTitles: string[];
}) {
  let previousOutputError: AiGenerationError | null = null;

  for (let attempt = 0; attempt <= MAX_PROFILE_GENERATION_RETRIES; attempt += 1) {
    let observedLogId: number | null = null;
    let model: string | undefined;
    let content: string | null;

    try {
      const completion = await createNvidiaChatCompletion({
        userId: input.userId,
        operation: input.operation,
        promptVersion: input.promptVersion,
        request: {
          messages: getRetryMessages({
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            attempt,
            previousError: previousOutputError,
          }),
          temperature: 0.35,
          max_tokens: 1200,
          stream: false,
        },
      });

      observedLogId = completion.logId;
      model = completion.model;
      content = completion.content;
    } catch (error) {
      if (isLlmClientError(error)) {
        const stage: AiGenerationStage = error.stage === "observability_log" ? "observability_log" : error.stage;
        throw new AiGenerationError(error.message, {
          stage,
          provider: error.provider,
          model: error.model,
          upstreamStatus: error.upstreamStatus,
          upstreamBody: error.upstreamBody,
          isProviderUnavailable: error.isProviderUnavailable,
          cause: error.originalError,
        });
      }

      throw error;
    }

    if (!content) {
      const error = new AiGenerationError("NVIDIA generation returned an empty response.", {
        stage: "provider_response",
        provider: "nvidia",
        model,
      });
      await markObservedCallFailed(observedLogId, error);
      throw error;
    }

    try {
      return {
        profile: parseAndValidateTasteProfileContent(content, input.blockedSummaryTitles, model),
        model: model ?? "unknown",
      };
    } catch (error) {
      if (!isAiGenerationError(error)) {
        throw error;
      }

      await markObservedCallFailed(observedLogId, error);
      if (!shouldRetryProfileOutput(error) || attempt >= MAX_PROFILE_GENERATION_RETRIES) {
        throw error;
      }

      previousOutputError = error;
    }
  }

  throw previousOutputError ?? new AiGenerationError("NVIDIA generation failed.", {
    stage: "provider_response",
    provider: "nvidia",
  });
}

export async function generateTvTasteProfile(userId: number, watchlist: WatchlistWithActivity[]) {
  const shows = buildPromptItems(watchlist);
  const sourceSummary = buildTvSourceSummary(shows);
  const evaluationContext = buildTvEvaluationContext(shows);
  const allowedTopGenres = getSourceGenreRanking(shows, (show) => show.genre, isUsableTvItem);

  if (shows.length === 0 || evaluationContext.confidenceTier === "no_signal") {
    throw new AiInsufficientSignalError(
      "tv",
      "Add at least one watched or rated TV season before generating a taste profile."
    );
  }

  const systemPrompt = [
    "You analyze a user's personal TV watching history and create compact, fun taste profiles.",
    "Use only the supplied data. Do not invent watched titles.",
    "Write directly to the user using you and your.",
    "Never write this viewer, the user, or they.",
    "Be specific, warm, and useful without sounding like an analytics report.",
    "Return only valid JSON that matches the requested schema.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    task: "Create a TV taste profile from this user's TV history.",
    outputSchema: {
      tasteSummary: "string",
      topGenres: ["string"],
      favoritePatterns: ["string"],
      recentTrends: ["string"],
      discoveryLanes: ["string"],
      tasteArchetype: {
        type: "object or null",
        primary: "string",
        secondary: ["string"],
        avoidancePattern: "string",
        recommendationNorthStar: "string",
      },
    },
    guidance: [
      "Make tasteSummary 150 to 500 words and make it recommendation-ready: someone should be able to recommend shows from this summary alone without seeing the watched list.",
      "In tasteSummary, explain likely taste across genre, tone, pacing, character/plot balance, themes, and storytelling style.",
      "Use fun, specific, compact phrasing. Avoid generic analytics language.",
      "Do not repeat obvious dashboard stats such as total shows, total seasons, or average rating.",
      ...sharedJsonGuidance,
      ...sharedTitleSafeSummaryGuidance,
      ...sharedEvaluationGuidance,
      ...sharedArchetypeGuidance,
      "For TV, archetypes may consider season-by-season behavior, ensemble/character dynamics, episode structure, pacing, premise complexity, genre blends, tone, and whether the user seems to prefer shows with a strong story engine.",
      "Use TV-native language such as shows, seasons, episodes, arcs, ensemble, procedural, serialized, comfort watch, prestige, genre, social game, or high-concept only when supported.",
      "Example style only, not a template to copy: The High-Concept Comfort Strategist.",
      "topGenres must contain only exact genre strings from allowedTopGenres. Do not invent genres or use tone, format, pacing, theme, trope, archetype, or storytelling-style labels.",
      "If allowedTopGenres is empty, return an empty topGenres array.",
      "Return at most 5 favoritePatterns.",
      "Return at most 5 discoveryLanes.",
      "If there are more than 5 plausible Favorite Patterns or Discovery Lanes, choose the strongest and most distinct ones.",
      "Do not split one idea into multiple bullets just to fill the list.",
      "Favorite Patterns means traits already visible in watched or rated history, such as tone, structure, pacing, character types, themes, or format.",
      "Discovery Lanes means future-facing directions the user may enjoy exploring next, based on Favorite Patterns.",
      "Favorite Patterns should explain current taste. Discovery Lanes should suggest where that taste could go next.",
      "Do not put the same idea in both Favorite Patterns and Discovery Lanes.",
      "Discovery Lanes should be phrased as paths to try, not specific title recommendations.",
      "Return 1 to 4 recentTrends when dated watch or rating activity shows a meaningful recent shift.",
      "Use recentTrends for changes in genre, tone, pacing, format, or viewing habits over time.",
      "Only return an empty recentTrends array when there is not enough dated activity to support a trend.",
      "Use only second-person wording. Never say this viewer, the user, or they.",
    ],
    evaluationContext,
    allowedTopGenres,
    sourceSummary,
    shows,
  });

  const generated = await generateTasteProfileFromPrompt({
    userId,
    operation: "tv_taste_profile",
    promptVersion: TV_TASTE_PROFILE_PROMPT_VERSION,
    systemPrompt,
    userPrompt,
    blockedSummaryTitles: shows.map((show) => show.title),
  });

  return {
    profile: applyArchetypeGate(
      applySourceTopGenreConstraint(generated.profile, allowedTopGenres),
      evaluationContext
    ),
    sourceSummary,
    model: generated.model,
    promptVersion: TV_TASTE_PROFILE_PROMPT_VERSION,
  };
}

export async function generateMovieTasteProfile(userId: number, movieList: MovieListWithActivity[]) {
  const movies = buildMoviePromptItems(movieList);
  const sourceSummary = buildMovieSourceSummary(movies);
  const evaluationContext = buildMovieEvaluationContext(movies);
  const allowedTopGenres = getSourceGenreRanking(movies, (movie) => movie.genre, isUsableMovieItem);

  if (movies.length === 0 || evaluationContext.confidenceTier === "no_signal") {
    throw new AiInsufficientSignalError(
      "movie",
      "Add at least one watched or rated movie before generating a taste profile."
    );
  }

  const systemPrompt = [
    "You analyze a user's personal movie watching history and create compact, fun taste profiles.",
    "Use only the supplied data. Do not invent watched titles.",
    "Write directly to the user using you and your.",
    "Never write this viewer, the user, or they.",
    "Be specific, warm, and useful without sounding like an analytics report.",
    "Return only valid JSON that matches the requested schema.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    task: "Create a movie taste profile from this user's movie history.",
    outputSchema: {
      tasteSummary: "string",
      topGenres: ["string"],
      favoritePatterns: ["string"],
      recentTrends: ["string"],
      discoveryLanes: ["string"],
      tasteArchetype: {
        type: "object or null",
        primary: "string",
        secondary: ["string"],
        avoidancePattern: "string",
        recommendationNorthStar: "string",
      },
    },
    guidance: [
      "Make tasteSummary 150 to 500 words and make it recommendation-ready: someone should be able to recommend movies from this summary alone without seeing the watched list.",
      "In tasteSummary, explain likely taste across genre, tone, pacing, themes, era, style, character/plot balance, and story scale.",
      "Use fun, specific, compact phrasing. Avoid generic analytics language.",
      "Treat watched and rated movies as the strongest signal. Movies without watched dates or ratings can still inform taste lightly.",
      "Do not repeat obvious dashboard stats such as total movies, watched movies, or average rating.",
      ...sharedJsonGuidance,
      ...sharedTitleSafeSummaryGuidance,
      ...sharedEvaluationGuidance,
      ...sharedArchetypeGuidance,
      "For movies, archetypes may consider story scale, era, genre blends, director/style signals from descriptions, tone, pacing, rewatchable comfort, spectacle, character focus, and rating contrast.",
      "Use movie-native language such as films, features, story scale, genre craft, tone, style, era, spectacle, character study, thriller engine, or comfort pick only when supported.",
      "The movie archetype should not sound like a TV viewing-habit label.",
      "topGenres must contain only exact genre strings from allowedTopGenres. Do not invent genres or use tone, format, pacing, theme, trope, archetype, or storytelling-style labels.",
      "If allowedTopGenres is empty, return an empty topGenres array.",
      "Return at most 5 favoritePatterns.",
      "Return at most 5 discoveryLanes.",
      "If there are more than 5 plausible Favorite Patterns or Discovery Lanes, choose the strongest and most distinct ones.",
      "Do not split one idea into multiple bullets just to fill the list.",
      "Favorite Patterns means traits already visible in watched or rated history, such as tone, structure, pacing, character types, themes, era, or filmmaking style.",
      "Discovery Lanes means future-facing directions the user may enjoy exploring next, based on Favorite Patterns.",
      "Favorite Patterns should explain current taste. Discovery Lanes should suggest where that taste could go next.",
      "Do not put the same idea in both Favorite Patterns and Discovery Lanes.",
      "Discovery Lanes should be phrased as paths to try, not specific title recommendations.",
      "Return 1 to 4 recentTrends when dated watch or rating activity shows a meaningful recent shift.",
      "Use recentTrends for changes in genre, tone, pacing, era, style, or viewing habits over time.",
      "Only return an empty recentTrends array when there is not enough dated activity to support a trend.",
      "Use only second-person wording. Never say this viewer, the user, or they.",
    ],
    evaluationContext,
    allowedTopGenres,
    sourceSummary,
    movies,
  });

  const generated = await generateTasteProfileFromPrompt({
    userId,
    operation: "movie_taste_profile",
    promptVersion: MOVIE_TASTE_PROFILE_PROMPT_VERSION,
    systemPrompt,
    userPrompt,
    blockedSummaryTitles: movies.map((movie) => movie.title),
  });

  return {
    profile: applyArchetypeGate(
      applySourceTopGenreConstraint(generated.profile, allowedTopGenres),
      evaluationContext
    ),
    sourceSummary,
    model: generated.model,
    promptVersion: MOVIE_TASTE_PROFILE_PROMPT_VERSION,
  };
}
