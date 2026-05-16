import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex, date, primaryKey, varchar, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username"),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
  };
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const tvShows = pgTable("tv_shows", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  year_start: text("year_start").notNull(),
  year_end: text("year_end"),
  seasons: integer("seasons"),
  episodes: integer("episodes"),
  genre: text("genre"),
  rating: text("rating"),
  description: text("description"),
  poster_url: text("poster_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  tvmaze_id: integer("tvmaze_id"), // Add TVmaze ID to connect with their API
});

export const insertTvShowSchema = createInsertSchema(tvShows).omit({
  id: true,
  created_at: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTvShow = z.infer<typeof insertTvShowSchema>;
export type TvShow = typeof tvShows.$inferSelect;

export const movies = pgTable("movies", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  release_year: text("release_year").notNull(),
  genre: text("genre"),
  rating: text("rating"),
  description: text("description"),
  poster_url: text("poster_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  tmdb_id: integer("tmdb_id"),
});

export const insertMovieSchema = createInsertSchema(movies).omit({
  id: true,
  created_at: true,
});

export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type Movie = typeof movies.$inferSelect;

// Extended schema for search validation
export const searchTvShowSchema = z.object({
  query: z.string().min(1, "Please enter a search term").optional(),
});

export type SearchTvShowParams = z.infer<typeof searchTvShowSchema>;

export const searchMovieSchema = z.object({
  query: z.string().min(1, "Please enter a search term").optional(),
});

export type SearchMovieParams = z.infer<typeof searchMovieSchema>;

// Watchlist tables
export const userWatchlists = pgTable("user_watchlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  showId: integer("show_id").notNull().references(() => tvShows.id),
  dateAdded: timestamp("date_added").defaultNow().notNull(),
}, (table) => {
  return {
    userShowUnique: uniqueIndex("user_show_unique").on(table.userId, table.showId),
  };
});

export const userWatchlistsRelations = relations(userWatchlists, ({ one }) => ({
  user: one(users, {
    fields: [userWatchlists.userId],
    references: [users.id],
  }),
  show: one(tvShows, {
    fields: [userWatchlists.showId],
    references: [tvShows.id],
  }),
  seasonProgress: one(seasonProgress),
}));

export const seasonProgress = pgTable("season_progress", {
  id: serial("id").primaryKey(),
  watchlistId: integer("watchlist_id").notNull().references(() => userWatchlists.id),
  seasonNumber: integer("season_number").notNull(),
  startDate: date("start_date"),
  finishDate: date("finish_date"),
  grade: varchar("grade", { length: 2 }), // A+, A, A-, etc.
  rating: integer("rating"), // 1-100
}, (table) => {
  return {
    seasonUnique: uniqueIndex("season_unique").on(table.watchlistId, table.seasonNumber),
  };
});

export const seasonProgressRelations = relations(seasonProgress, ({ one }) => ({
  watchlist: one(userWatchlists, {
    fields: [seasonProgress.watchlistId],
    references: [userWatchlists.id],
  }),
}));

export const userMovieLists = pgTable("user_movie_lists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  movieId: integer("movie_id").notNull().references(() => movies.id),
  dateAdded: timestamp("date_added").defaultNow().notNull(),
}, (table) => {
  return {
    userMovieUnique: uniqueIndex("user_movie_unique").on(table.userId, table.movieId),
  };
});

export const movieActivity = pgTable("movie_activity", {
  id: serial("id").primaryKey(),
  movieListId: integer("movie_list_id").notNull().references(() => userMovieLists.id),
  dateWatched: date("date_watched", { mode: "string" }),
  rating: integer("rating"),
  watchedUsing: text("watched_using"),
}, (table) => {
  return {
    movieListUnique: uniqueIndex("movie_list_unique").on(table.movieListId),
  };
});

export const movieActivityRelations = relations(movieActivity, ({ one }) => ({
  movieList: one(userMovieLists, {
    fields: [movieActivity.movieListId],
    references: [userMovieLists.id],
  }),
}));

export const userShareSettings = pgTable("user_share_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  enabled: boolean("enabled").default(false).notNull(),
  includeAllYears: boolean("include_all_years").default(true).notNull(),
  sharedYears: json("shared_years").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userShareSettingsUserUnique: uniqueIndex("user_share_settings_user_id_unique").on(table.userId),
  };
});

export const userShareSettingsRelations = relations(userShareSettings, ({ one }) => ({
  user: one(users, {
    fields: [userShareSettings.userId],
    references: [users.id],
  }),
}));

export const aiMediaTypes = ["tv", "movie"] as const;
export const aiInsightTypes = ["taste_profile"] as const;

export type AiMediaType = typeof aiMediaTypes[number];
export type AiInsightType = typeof aiInsightTypes[number];

export type AiTasteProfile = {
  tasteSummary: string;
  topGenres: string[];
  favoritePatterns: string[];
  recentTrends?: string[];
  discoveryLanes: string[];
};

export type AiInsightSourceSummary = {
  showCount?: number;
  watchedSeasonCount?: number;
  ratedSeasonCount?: number;
  movieCount?: number;
  watchedMovieCount?: number;
  ratedMovieCount?: number;
  averageRating?: number | null;
  genreCount?: number;
  dateRange?: {
    start?: string | null;
    end?: string | null;
  };
};

export const userAiInsights = pgTable("user_ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  mediaType: text("media_type").$type<AiMediaType>().notNull(),
  insightType: text("insight_type").$type<AiInsightType>().notNull(),
  profile: json("profile").$type<AiTasteProfile>().notNull(),
  sourceSummary: json("source_summary").$type<AiInsightSourceSummary>().notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  generatedAt: timestamp("generated_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    userAiInsightUnique: uniqueIndex("user_ai_insights_user_media_type_unique").on(
      table.userId,
      table.mediaType,
      table.insightType
    ),
  };
});

export const userAiInsightsRelations = relations(userAiInsights, ({ one }) => ({
  user: one(users, {
    fields: [userAiInsights.userId],
    references: [users.id],
  }),
}));

export type LlmCallStatus = "success" | "error";

export type LlmUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export const llmCallLogs = pgTable("llm_call_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  provider: text("provider").notNull(),
  operation: text("operation").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version"),
  requestPayload: json("request_payload").notNull(),
  outputText: text("output_text"),
  rawResponse: json("raw_response"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  responseTimeMs: integer("response_time_ms").notNull(),
  status: text("status").$type<LlmCallStatus>().notNull(),
  errorStage: text("error_stage"),
  errorMessage: text("error_message"),
  errorStatusCode: integer("error_status_code"),
  errorBody: text("error_body"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    createdAtIdx: index("llm_call_logs_created_at_idx").on(table.createdAt),
    statusIdx: index("llm_call_logs_status_idx").on(table.status),
    operationIdx: index("llm_call_logs_operation_idx").on(table.operation),
    modelIdx: index("llm_call_logs_model_idx").on(table.model),
    userIdx: index("llm_call_logs_user_id_idx").on(table.userId),
  };
});

export const llmCallLogsRelations = relations(llmCallLogs, ({ one }) => ({
  user: one(users, {
    fields: [llmCallLogs.userId],
    references: [users.id],
  }),
}));

export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6, mode: "date" }).notNull(),
});

export const userMovieListsRelations = relations(userMovieLists, ({ one }) => ({
  user: one(users, {
    fields: [userMovieLists.userId],
    references: [users.id],
  }),
  movie: one(movies, {
    fields: [userMovieLists.movieId],
    references: [movies.id],
  }),
  activity: one(movieActivity),
}));

// Insert schemas for the new tables
export const insertUserWatchlistSchema = createInsertSchema(userWatchlists).omit({
  id: true,
  dateAdded: true,
});

export const insertSeasonProgressSchema = createInsertSchema(seasonProgress).omit({
  id: true,
});

export const insertUserMovieListSchema = createInsertSchema(userMovieLists).omit({
  id: true,
  dateAdded: true,
});

export const insertMovieActivitySchema = createInsertSchema(movieActivity).omit({
  id: true,
});

export const insertUserShareSettingsSchema = createInsertSchema(userShareSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserAiInsightSchema = createInsertSchema(userAiInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLlmCallLogSchema = createInsertSchema(llmCallLogs).omit({
  id: true,
  createdAt: true,
});

// Extended schema for validation
export const seasonProgressValidationSchema = z.object({
  seasonNumber: z.number().int().positive(),
  startDate: z.date().optional().nullable(),
  finishDate: z.date().optional().nullable(),
  grade: z.enum(["A+", "A", "A-", "B+", "B", "B-", "C", "D", "E"]).optional().nullable(),
  rating: z.number().int().min(1).max(100).optional().nullable(),
});

export const movieActivityValidationSchema = z.object({
  dateWatched: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  rating: z.number().int().min(1).max(100).optional().nullable(),
  watchedUsing: z.enum([
    "AMC (Theater)",
    "Netflix",
    "Prime Video",
    "Max",
    "Peacock",
    "Paramount+",
    "Apple TV+",
    "Disney+",
    "Hulu",
    "MGM+",
    "Starz",
    "Showtime",
    "Crunchyroll",
    "Other"
  ]).optional().nullable(),
});

// Types
export type InsertUserWatchlist = z.infer<typeof insertUserWatchlistSchema>;
export type UserWatchlist = typeof userWatchlists.$inferSelect;

export type InsertSeasonProgress = z.infer<typeof insertSeasonProgressSchema>;
export type SeasonProgress = typeof seasonProgress.$inferSelect;

export type InsertUserMovieList = z.infer<typeof insertUserMovieListSchema>;
export type UserMovieList = typeof userMovieLists.$inferSelect;

export type InsertMovieActivity = z.infer<typeof insertMovieActivitySchema>;
export type MovieActivity = typeof movieActivity.$inferSelect;

export type InsertUserShareSettings = z.infer<typeof insertUserShareSettingsSchema>;
export type UserShareSettings = typeof userShareSettings.$inferSelect;

export type InsertUserAiInsight = z.infer<typeof insertUserAiInsightSchema>;
export type UserAiInsight = typeof userAiInsights.$inferSelect;

export type InsertLlmCallLog = typeof llmCallLogs.$inferInsert;
export type LlmCallLog = typeof llmCallLogs.$inferSelect;
