import { z } from "zod";
import type { AiInsightSourceSummary, AiTasteProfile, SeasonProgress, TvShow, UserWatchlist } from "@shared/schema";

export const TV_TASTE_PROFILE_PROMPT_VERSION = "tv-taste-profile-v3";

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

type NvidiaChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type AiGenerationStage =
  | "config"
  | "provider_request"
  | "provider_http"
  | "provider_response"
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

function isProviderUnavailable(status?: number, body?: string, statusText?: string) {
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }

  const text = `${body ?? ""} ${statusText ?? ""}`.toLowerCase();
  return [
    "resourceexhausted",
    "resource exhausted",
    "service unavailable",
    "temporarily unavailable",
    "all workers are busy",
    "workers are busy",
    "please retry later",
    "overloaded",
    "capacity",
  ].some((needle) => text.includes(needle));
}

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

function buildSourceSummary(items: ShowPromptItem[]): AiInsightSourceSummary {
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

function getNvidiaConfig() {
  const baseUrl = process.env.NVIDIA_BASE_URL;
  const apiKey = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new AiGenerationError("NVIDIA AI insight configuration is incomplete.", {
      stage: "config",
      provider: "nvidia",
      model,
    });
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    model,
  };
}

export async function generateTvTasteProfile(watchlist: WatchlistWithActivity[]) {
  const config = getNvidiaConfig();
  const shows = buildPromptItems(watchlist);
  const sourceSummary = buildSourceSummary(shows);

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

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 1200,
        stream: false,
      }),
    });
  } catch (error) {
    throw new AiGenerationError("NVIDIA provider request failed.", {
      stage: "provider_request",
      provider: "nvidia",
      model: config.model,
      isProviderUnavailable: true,
      cause: error,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new AiGenerationError("NVIDIA provider returned an unsuccessful response.", {
      stage: "provider_http",
      provider: "nvidia",
      model: config.model,
      upstreamStatus: response.status,
      upstreamBody: errorText,
      isProviderUnavailable: isProviderUnavailable(response.status, errorText, response.statusText),
    });
  }

  const responseText = await response.text();
  let data: NvidiaChatCompletionResponse;
  try {
    data = JSON.parse(responseText) as NvidiaChatCompletionResponse;
  } catch (error) {
    throw new AiGenerationError("NVIDIA provider returned invalid JSON.", {
      stage: "provider_response",
      provider: "nvidia",
      model: config.model,
      upstreamBody: responseText,
      cause: error,
    });
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiGenerationError("NVIDIA generation returned an empty response.", {
      stage: "provider_response",
      provider: "nvidia",
      model: config.model,
      upstreamBody: responseText,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch (error) {
    if (isAiGenerationError(error)) {
      error.model = config.model;
      error.upstreamBody = content;
      throw error;
    }

    throw new AiGenerationError("NVIDIA generation returned invalid profile JSON.", {
      stage: "profile_parse",
      provider: "nvidia",
      model: config.model,
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
      model: config.model,
      upstreamBody: content,
      cause: error,
    });
  }

  return {
    profile,
    sourceSummary,
    model: config.model,
    promptVersion: TV_TASTE_PROFILE_PROMPT_VERSION,
  };
}
