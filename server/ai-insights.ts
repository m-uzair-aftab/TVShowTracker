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
import { createNvidiaChatCompletion, isLlmClientError } from "./llm-client";
import { storage } from "./storage";

export const TV_TASTE_PROFILE_PROMPT_VERSION = "tv-taste-profile-v3";
export const MOVIE_TASTE_PROFILE_PROMPT_VERSION = "movie-taste-profile-v1";

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

const tasteProfileSchema = z.object({
  tasteSummary: z.string().min(1),
  topGenres: z.array(z.string()).default([]),
  favoritePatterns: z.array(z.string()).max(5).default([]),
  recentTrends: z.array(z.string()).optional(),
  discoveryLanes: z.array(z.string()).max(5).default([]),
});

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

async function generateTasteProfileFromPrompt(input: {
  userId: number;
  operation: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  let observedLogId: number | null = null;
  let model: string | undefined;
  let content: string | null;

  try {
    const completion = await createNvidiaChatCompletion({
      userId: input.userId,
      operation: input.operation,
      promptVersion: input.promptVersion,
      request: {
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch (error) {
    if (isAiGenerationError(error)) {
      error.model = model;
      error.upstreamBody = content;
      await markObservedCallFailed(observedLogId, error);
      throw error;
    }

    const aiError = new AiGenerationError("NVIDIA generation returned invalid profile JSON.", {
      stage: "profile_parse",
      provider: "nvidia",
      model,
      upstreamBody: content,
      cause: error,
    });
    await markObservedCallFailed(observedLogId, aiError);
    throw aiError;
  }

  let profile: AiTasteProfile;
  try {
    profile = tasteProfileSchema.parse(parsed);
  } catch (error) {
    const aiError = new AiGenerationError("NVIDIA generation returned a profile with an invalid schema.", {
      stage: "profile_validation",
      provider: "nvidia",
      model,
      upstreamBody: content,
      cause: error,
    });
    await markObservedCallFailed(observedLogId, aiError);
    throw aiError;
  }

  return {
    profile,
    model: model ?? "unknown",
  };
}

export async function generateTvTasteProfile(userId: number, watchlist: WatchlistWithActivity[]) {
  const shows = buildPromptItems(watchlist);
  const sourceSummary = buildTvSourceSummary(shows);

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
    },
    guidance: [
      "Make tasteSummary 150 to 500 words and make it recommendation-ready: someone should be able to recommend shows from this summary alone without seeing the watched list.",
      "In tasteSummary, explain likely taste across genre, tone, pacing, character/plot balance, themes, and storytelling style.",
      "Use fun, specific, compact phrasing. Avoid generic analytics language.",
      "Do not repeat obvious dashboard stats such as total shows, total seasons, or average rating.",
      "topGenres should contain 3 to 6 concise labels or genre blends.",
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
    sourceSummary,
    shows,
  });

  const generated = await generateTasteProfileFromPrompt({
    userId,
    operation: "tv_taste_profile",
    promptVersion: TV_TASTE_PROFILE_PROMPT_VERSION,
    systemPrompt,
    userPrompt,
  });

  return {
    profile: generated.profile,
    sourceSummary,
    model: generated.model,
    promptVersion: TV_TASTE_PROFILE_PROMPT_VERSION,
  };
}

export async function generateMovieTasteProfile(userId: number, movieList: MovieListWithActivity[]) {
  const movies = buildMoviePromptItems(movieList);
  const sourceSummary = buildMovieSourceSummary(movies);

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
    },
    guidance: [
      "Make tasteSummary 150 to 500 words and make it recommendation-ready: someone should be able to recommend movies from this summary alone without seeing the watched list.",
      "In tasteSummary, explain likely taste across genre, tone, pacing, themes, era, style, character/plot balance, and story scale.",
      "Use fun, specific, compact phrasing. Avoid generic analytics language.",
      "Treat watched and rated movies as the strongest signal. Movies without watched dates or ratings can still inform taste lightly.",
      "Do not repeat obvious dashboard stats such as total movies, watched movies, or average rating.",
      "topGenres should contain 3 to 6 concise labels or genre blends.",
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
    sourceSummary,
    movies,
  });

  const generated = await generateTasteProfileFromPrompt({
    userId,
    operation: "movie_taste_profile",
    promptVersion: MOVIE_TASTE_PROFILE_PROMPT_VERSION,
    systemPrompt,
    userPrompt,
  });

  return {
    profile: generated.profile,
    sourceSummary,
    model: generated.model,
    promptVersion: MOVIE_TASTE_PROFILE_PROMPT_VERSION,
  };
}
