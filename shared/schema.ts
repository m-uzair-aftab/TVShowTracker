import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex, date, primaryKey, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

// Extended schema for search validation
export const searchTvShowSchema = z.object({
  query: z.string().min(1, "Please enter a search term").optional(),
});

export type SearchTvShowParams = z.infer<typeof searchTvShowSchema>;

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

// Insert schemas for the new tables
export const insertUserWatchlistSchema = createInsertSchema(userWatchlists).omit({
  id: true,
  dateAdded: true,
});

export const insertSeasonProgressSchema = createInsertSchema(seasonProgress).omit({
  id: true,
});

// Extended schema for validation
export const seasonProgressValidationSchema = z.object({
  seasonNumber: z.number().int().positive(),
  startDate: z.date().optional().nullable(),
  finishDate: z.date().optional().nullable(),
  grade: z.enum(["A+", "A", "A-", "B+", "B", "B-", "C", "D", "E"]).optional().nullable(),
  rating: z.number().int().min(1).max(100).optional().nullable(),
});

// Types
export type InsertUserWatchlist = z.infer<typeof insertUserWatchlistSchema>;
export type UserWatchlist = typeof userWatchlists.$inferSelect;

export type InsertSeasonProgress = z.infer<typeof insertSeasonProgressSchema>;
export type SeasonProgress = typeof seasonProgress.$inferSelect;
