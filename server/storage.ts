import { 
  tvShows, type TvShow, type InsertTvShow, 
  movies, type Movie, type InsertMovie,
  users, type User, type InsertUser,
  userWatchlists, type UserWatchlist, type InsertUserWatchlist,
  seasonProgress, type SeasonProgress, type InsertSeasonProgress,
  userMovieLists, type UserMovieList, type InsertUserMovieList,
  movieActivity, type MovieActivity, type InsertMovieActivity,
  userShareSettings, type UserShareSettings,
  userAiInsights, type UserAiInsight, type AiMediaType, type AiInsightType,
  llmCallLogs, type LlmCallLog, type InsertLlmCallLog, type LlmCallStatus,
  type AiTasteProfile, type AiInsightSourceSummary
} from "@shared/schema";
import { db } from "./db";
import { desc, eq, gte, ilike, and, lte, lt, sql, inArray, type SQL } from "drizzle-orm";

export type LlmCallLogFilters = {
  from?: Date;
  to?: Date;
  model?: string;
  status?: LlmCallStatus;
  operation?: string;
  userId?: number;
  limit: number;
  offset: number;
};

export type LlmCallLogWithUser = LlmCallLog & {
  user: {
    id: number;
    username: string | null;
    displayName: string;
    email: string;
  } | null;
};

export type LlmCallSummary = {
  totalCalls: number;
  successfulCalls: number;
  erroredCalls: number;
  averageResponseTimeMs: number | null;
  p95ResponseTimeMs: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalTokens: number | null;
  byModel: Array<{
    model: string;
    totalCalls: number;
    erroredCalls: number;
    averageResponseTimeMs: number | null;
  }>;
  recentErrors: Array<{
    errorStage: string | null;
    errorMessage: string | null;
    count: number;
    lastSeenAt: Date;
  }>;
};

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserUsername(userId: number, username: string | null): Promise<User | undefined>;
  
  // TV Show methods
  getAllTvShows(): Promise<TvShow[]>;
  searchTvShows(query: string): Promise<TvShow[]>;
  getTvShow(id: number): Promise<TvShow | undefined>;
  createTvShow(show: InsertTvShow): Promise<TvShow>;
  updateTvShow(id: number, show: Partial<InsertTvShow>): Promise<TvShow | undefined>;
  deleteTvShow(id: number): Promise<boolean>;

  // Movie methods
  getAllMovies(): Promise<Movie[]>;
  searchMovies(query: string): Promise<Movie[]>;
  getMovie(id: number): Promise<Movie | undefined>;
  createMovie(movie: InsertMovie): Promise<Movie>;
  updateMovie(id: number, movie: Partial<InsertMovie>): Promise<Movie | undefined>;
  deleteMovie(id: number): Promise<boolean>;
  
  // Watchlist methods
  addToWatchlist(userId: number, showId: number): Promise<UserWatchlist>;
  removeFromWatchlist(userId: number, showId: number): Promise<boolean>;
  getUserWatchlist(userId: number): Promise<(UserWatchlist & { show: TvShow })[]>;
  getWatchlistItem(userId: number, showId: number): Promise<UserWatchlist | undefined>;

  // Movie list methods
  addToMovieList(userId: number, movieId: number): Promise<UserMovieList>;
  removeFromMovieList(userId: number, movieId: number): Promise<boolean>;
  getUserMovieList(userId: number): Promise<(UserMovieList & { movie: Movie })[]>;
  getUserMovieListWithActivity(userId: number): Promise<(UserMovieList & { movie: Movie, activity: MovieActivity | null })[]>;
  getMovieListItem(userId: number, movieId: number): Promise<UserMovieList | undefined>;
  getMovieActivity(movieListId: number): Promise<MovieActivity | undefined>;
  updateMovieActivity(movieListId: number, activity: Partial<InsertMovieActivity>): Promise<MovieActivity>;
  
  // Season progress methods
  getSeasonProgress(watchlistId: number, seasonNumber?: number): Promise<SeasonProgress[]>;
  updateSeasonProgress(watchlistId: number, seasonNumber: number, progress: Partial<InsertSeasonProgress>): Promise<SeasonProgress>;

  // Share settings methods
  getUserShareSettings(userId: number): Promise<UserShareSettings | undefined>;
  getOrCreateUserShareSettings(userId: number): Promise<UserShareSettings>;
  updateUserShareSettings(userId: number, settings: Partial<Pick<UserShareSettings, "enabled" | "includeAllYears" | "sharedYears" | "shareTasteProfiles">>): Promise<UserShareSettings>;
  getUserActivityYears(userId: number): Promise<string[]>;

  // AI insight methods
  getUserAiInsight(userId: number, mediaType: AiMediaType, insightType: AiInsightType): Promise<UserAiInsight | undefined>;
  upsertUserAiInsight(input: {
    userId: number;
    mediaType: AiMediaType;
    insightType: AiInsightType;
    profile: AiTasteProfile;
    sourceSummary: AiInsightSourceSummary;
    model: string;
    promptVersion: string;
    generatedAt: Date;
  }): Promise<UserAiInsight>;

  // LLM observability methods
  createLlmCallLog(input: InsertLlmCallLog): Promise<LlmCallLog>;
  markLlmCallLogFailed(logId: number, input: {
    errorStage: string;
    errorMessage: string;
    errorBody?: string | null;
  }): Promise<void>;
  pruneOldLlmCallLogs(olderThan: Date): Promise<void>;
  getLlmCallLogs(filters: LlmCallLogFilters): Promise<{ logs: LlmCallLogWithUser[]; total: number }>;
  getLlmCallSummary(filters: Omit<LlmCallLogFilters, "limit" | "offset">): Promise<LlmCallSummary>;
}

export class DatabaseStorage implements IStorage {
  private buildLlmCallLogWhere(filters: Partial<Omit<LlmCallLogFilters, "limit" | "offset">>) {
    const conditions: SQL<unknown>[] = [];

    if (filters.from) conditions.push(gte(llmCallLogs.createdAt, filters.from));
    if (filters.to) conditions.push(lte(llmCallLogs.createdAt, filters.to));
    if (filters.model) conditions.push(eq(llmCallLogs.model, filters.model));
    if (filters.status) conditions.push(eq(llmCallLogs.status, filters.status));
    if (filters.operation) conditions.push(eq(llmCallLogs.operation, filters.operation));
    if (filters.userId !== undefined) conditions.push(eq(llmCallLogs.userId, filters.userId));

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private formatLlmLogUser(user: {
    id: number | null;
    username: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null) {
    if (!user || user.id === null || user.email === null) return null;

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ")
      || user.username
      || user.email;

    return {
      id: user.id,
      username: user.username,
      displayName,
      email: user.email,
    };
  }

  private isMissingUsernameColumnError(error: unknown): boolean {
    return typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: string }).code === "42703"
      && error instanceof Error
      && error.message.includes("username");
  }

  private async getUserWithoutUsername(whereClause: ReturnType<typeof eq>): Promise<User | undefined> {
    const result = await db.select({
      id: users.id,
      email: users.email,
      username: sql<string | null>`null`,
      password: users.password,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause);

    return result[0];
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      if (this.isMissingUsernameColumnError(error)) {
        return this.getUserWithoutUsername(eq(users.id, id));
      }
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username));
      return result[0];
    } catch (error) {
      if (this.isMissingUsernameColumnError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email));
      return result[0];
    } catch (error) {
      if (this.isMissingUsernameColumnError(error)) {
        return this.getUserWithoutUsername(eq(users.email, email));
      }
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    } catch (error) {
      if (this.isMissingUsernameColumnError(error)) {
        const [user] = await db.insert(users).values(insertUser).returning({
          id: users.id,
          email: users.email,
          username: sql<string | null>`null`,
          password: users.password,
          firstName: users.firstName,
          lastName: users.lastName,
          createdAt: users.createdAt,
        });
        return user;
      }
      throw error;
    }
  }

  async updateUserUsername(userId: number, username: string | null): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set({ username })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }
  
  // TV Show methods
  async getAllTvShows(): Promise<TvShow[]> {
    return await db.select().from(tvShows);
  }
  
  async searchTvShows(query: string): Promise<TvShow[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(tvShows).where(
      ilike(tvShows.title, searchPattern)
    );
  }
  
  async getTvShow(id: number): Promise<TvShow | undefined> {
    const shows = await db.select().from(tvShows).where(eq(tvShows.id, id));
    return shows[0];
  }
  
  async createTvShow(insertShow: InsertTvShow): Promise<TvShow> {
    const [show] = await db.insert(tvShows).values(insertShow).returning();
    return show;
  }
  
  async updateTvShow(id: number, updateData: Partial<InsertTvShow>): Promise<TvShow | undefined> {
    const [updatedShow] = await db.update(tvShows)
      .set(updateData)
      .where(eq(tvShows.id, id))
      .returning();
    
    return updatedShow;
  }
  
  async deleteTvShow(id: number): Promise<boolean> {
    const result = await db.delete(tvShows).where(eq(tvShows.id, id));
    return !!result;
  }

  // Movie methods
  async getAllMovies(): Promise<Movie[]> {
    return await db.select().from(movies);
  }

  async searchMovies(query: string): Promise<Movie[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(movies).where(
      ilike(movies.title, searchPattern)
    );
  }

  async getMovie(id: number): Promise<Movie | undefined> {
    const result = await db.select().from(movies).where(eq(movies.id, id));
    return result[0];
  }

  async createMovie(insertMovie: InsertMovie): Promise<Movie> {
    const [movie] = await db.insert(movies).values(insertMovie).returning();
    return movie;
  }

  async updateMovie(id: number, updateData: Partial<InsertMovie>): Promise<Movie | undefined> {
    const [updatedMovie] = await db.update(movies)
      .set(updateData)
      .where(eq(movies.id, id))
      .returning();

    return updatedMovie;
  }

  async deleteMovie(id: number): Promise<boolean> {
    const result = await db.delete(movies).where(eq(movies.id, id));
    return !!result;
  }
  
  // Watchlist methods
  async addToWatchlist(userId: number, showId: number): Promise<UserWatchlist> {
    // Check if already in watchlist
    const existing = await this.getWatchlistItem(userId, showId);
    if (existing) {
      return existing;
    }
    
    // Add to watchlist
    const [watchlistItem] = await db.insert(userWatchlists)
      .values({ userId, showId })
      .returning();
      
    return watchlistItem;
  }
  
  async removeFromWatchlist(userId: number, showId: number): Promise<boolean> {
    // Find the watchlist item
    const watchlistItem = await this.getWatchlistItem(userId, showId);
    if (!watchlistItem) {
      return false;
    }
    
    // Remove all season progress entries first
    await db.delete(seasonProgress)
      .where(eq(seasonProgress.watchlistId, watchlistItem.id));
    
    // Then remove the watchlist item
    const result = await db.delete(userWatchlists)
      .where(
        and(
          eq(userWatchlists.userId, userId),
          eq(userWatchlists.showId, showId)
        )
      );
      
    return !!result;
  }
  
  async getUserWatchlist(userId: number): Promise<(UserWatchlist & { show: TvShow })[]> {
    const result = await db.select({
      watchlist: userWatchlists,
      show: tvShows
    })
    .from(userWatchlists)
    .innerJoin(tvShows, eq(userWatchlists.showId, tvShows.id))
    .where(eq(userWatchlists.userId, userId));
    
    return result.map(item => ({
      ...item.watchlist,
      show: item.show
    }));
  }
  
  async getUserWatchlistWithActivity(userId: number): Promise<(UserWatchlist & { 
    show: TvShow, 
    lastActivity: string | null,
    seasons: SeasonProgress[]
  })[]> {
    const watchlistItems = await this.getUserWatchlist(userId);

    if (watchlistItems.length === 0) {
      return [];
    }

    const watchlistIds = watchlistItems.map((item) => item.id);
    const seasonRows = await db.select()
      .from(seasonProgress)
      .where(inArray(seasonProgress.watchlistId, watchlistIds));

    const seasonsByWatchlistId = new Map<number, SeasonProgress[]>();
    for (const season of seasonRows) {
      const seasons = seasonsByWatchlistId.get(season.watchlistId) ?? [];
      seasons.push(season);
      seasonsByWatchlistId.set(season.watchlistId, seasons);
    }

    const result = watchlistItems.map((item) => {
      const seasons = (seasonsByWatchlistId.get(item.id) ?? [])
        .sort((a, b) => a.seasonNumber - b.seasonNumber);
      let lastActivity: string | null = null;

      for (const season of seasons) {
        const startDate = season.startDate ? new Date(season.startDate) : null;
        const finishDate = season.finishDate ? new Date(season.finishDate) : null;

        if (startDate && (!lastActivity || startDate > new Date(lastActivity))) {
          lastActivity = startDate.toISOString();
        }

        if (finishDate && (!lastActivity || finishDate > new Date(lastActivity))) {
          lastActivity = finishDate.toISOString();
        }
      }

      return {
        ...item,
        lastActivity,
        seasons
      };
    });

    // Sort by lastActivity (newest first), with shows without activity at the end
    return result.sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;  // a goes after b
      if (!b.lastActivity) return -1; // a goes before b
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });
  }
  
  async getWatchlistItem(userId: number, showId: number): Promise<UserWatchlist | undefined> {
    const result = await db.select()
      .from(userWatchlists)
      .where(
        and(
          eq(userWatchlists.userId, userId),
          eq(userWatchlists.showId, showId)
        )
      );
      
    return result[0];
  }

  // Movie list methods
  async addToMovieList(userId: number, movieId: number): Promise<UserMovieList> {
    const existing = await this.getMovieListItem(userId, movieId);
    if (existing) {
      return existing;
    }

    const [listItem] = await db.insert(userMovieLists)
      .values({ userId, movieId })
      .returning();

    return listItem;
  }

  async removeFromMovieList(userId: number, movieId: number): Promise<boolean> {
    const listItem = await this.getMovieListItem(userId, movieId);
    if (!listItem) {
      return false;
    }

    await db.delete(movieActivity)
      .where(eq(movieActivity.movieListId, listItem.id));

    const result = await db.delete(userMovieLists)
      .where(
        and(
          eq(userMovieLists.userId, userId),
          eq(userMovieLists.movieId, movieId)
        )
      );

    return !!result;
  }

  async getUserMovieList(userId: number): Promise<(UserMovieList & { movie: Movie })[]> {
    const result = await db.select({
      list: userMovieLists,
      movie: movies
    })
    .from(userMovieLists)
    .innerJoin(movies, eq(userMovieLists.movieId, movies.id))
    .where(eq(userMovieLists.userId, userId));

    return result.map(item => ({
      ...item.list,
      movie: item.movie
    }));
  }

  async getUserMovieListWithActivity(userId: number): Promise<(UserMovieList & { movie: Movie, activity: MovieActivity | null })[]> {
    const result = await db.select({
      list: userMovieLists,
      movie: movies,
      activity: movieActivity
    })
    .from(userMovieLists)
    .innerJoin(movies, eq(userMovieLists.movieId, movies.id))
    .leftJoin(movieActivity, eq(movieActivity.movieListId, userMovieLists.id))
    .where(eq(userMovieLists.userId, userId));

    return result.map(item => ({
      ...item.list,
      movie: item.movie,
      activity: item.activity ?? null
    }));
  }

  async getMovieListItem(userId: number, movieId: number): Promise<UserMovieList | undefined> {
    const result = await db.select()
      .from(userMovieLists)
      .where(
        and(
          eq(userMovieLists.userId, userId),
          eq(userMovieLists.movieId, movieId)
        )
      );

    return result[0];
  }

  async getMovieActivity(movieListId: number): Promise<MovieActivity | undefined> {
    const result = await db.select()
      .from(movieActivity)
      .where(eq(movieActivity.movieListId, movieListId));

    return result[0];
  }

  async updateMovieActivity(movieListId: number, activityData: Partial<InsertMovieActivity>): Promise<MovieActivity> {
    const existing = await this.getMovieActivity(movieListId);

    if (existing) {
      const [updated] = await db.update(movieActivity)
        .set(activityData)
        .where(eq(movieActivity.movieListId, movieListId))
        .returning();

      return updated;
    }

    const [created] = await db.insert(movieActivity)
      .values({
        movieListId,
        ...activityData
      })
      .returning();

    return created;
  }
  
  // Season progress methods
  async getSeasonProgress(watchlistId: number, seasonNumber?: number): Promise<SeasonProgress[]> {
    let result;
    
    if (seasonNumber !== undefined) {
      result = await db.select()
        .from(seasonProgress)
        .where(
          and(
            eq(seasonProgress.watchlistId, watchlistId),
            eq(seasonProgress.seasonNumber, seasonNumber)
          )
        );
    } else {
      result = await db.select()
        .from(seasonProgress)
        .where(eq(seasonProgress.watchlistId, watchlistId));
    }
    
    return result;
  }
  
  async updateSeasonProgress(watchlistId: number, seasonNumber: number, progressData: Partial<InsertSeasonProgress>): Promise<SeasonProgress> {
    // Check if progress entry exists
    const existing = await this.getSeasonProgress(watchlistId, seasonNumber);
    
    if (existing.length > 0) {
      // Update existing entry
      const [updated] = await db.update(seasonProgress)
        .set(progressData)
        .where(
          and(
            eq(seasonProgress.watchlistId, watchlistId),
            eq(seasonProgress.seasonNumber, seasonNumber)
          )
        )
        .returning();
        
      return updated;
    } else {
      // Create new entry
      const [newProgress] = await db.insert(seasonProgress)
        .values({
          watchlistId,
          seasonNumber,
          ...progressData
        })
        .returning();
        
      return newProgress;
    }
  }

  async getUserShareSettings(userId: number): Promise<UserShareSettings | undefined> {
    const result = await db.select()
      .from(userShareSettings)
      .where(eq(userShareSettings.userId, userId));

    return result[0];
  }

  async getOrCreateUserShareSettings(userId: number): Promise<UserShareSettings> {
    const existing = await this.getUserShareSettings(userId);
    if (existing) {
      return existing;
    }

    const [created] = await db.insert(userShareSettings)
      .values({
        userId,
        enabled: false,
        includeAllYears: true,
        sharedYears: [],
        shareTasteProfiles: false,
      })
      .returning();

    return created;
  }

  async updateUserShareSettings(
    userId: number,
    settings: Partial<Pick<UserShareSettings, "enabled" | "includeAllYears" | "sharedYears" | "shareTasteProfiles">>
  ): Promise<UserShareSettings> {
    await this.getOrCreateUserShareSettings(userId);

    const [updated] = await db.update(userShareSettings)
      .set({
        ...settings,
        updatedAt: new Date(),
      })
      .where(eq(userShareSettings.userId, userId))
      .returning();

    return updated;
  }

  async getUserActivityYears(userId: number): Promise<string[]> {
    const years = new Set<string>();

    const shows = await this.getUserWatchlistWithActivity(userId);
    for (const item of shows) {
      for (const season of item.seasons) {
        const startYear = season.startDate?.slice(0, 4);
        const finishYear = season.finishDate?.slice(0, 4);
        if (startYear) years.add(startYear);
        if (finishYear) years.add(finishYear);
      }
    }

    const movieList = await this.getUserMovieListWithActivity(userId);
    for (const item of movieList) {
      const watchedYear = item.activity?.dateWatched?.slice(0, 4);
      if (watchedYear) years.add(watchedYear);
    }

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }

  async getUserAiInsight(
    userId: number,
    mediaType: AiMediaType,
    insightType: AiInsightType
  ): Promise<UserAiInsight | undefined> {
    const result = await db.select()
      .from(userAiInsights)
      .where(
        and(
          eq(userAiInsights.userId, userId),
          eq(userAiInsights.mediaType, mediaType),
          eq(userAiInsights.insightType, insightType)
        )
      );

    return result[0];
  }

  async upsertUserAiInsight(input: {
    userId: number;
    mediaType: AiMediaType;
    insightType: AiInsightType;
    profile: AiTasteProfile;
    sourceSummary: AiInsightSourceSummary;
    model: string;
    promptVersion: string;
    generatedAt: Date;
  }): Promise<UserAiInsight> {
    const [insight] = await db.insert(userAiInsights)
      .values(input)
      .onConflictDoUpdate({
        target: [
          userAiInsights.userId,
          userAiInsights.mediaType,
          userAiInsights.insightType,
        ],
        set: {
          profile: input.profile,
          sourceSummary: input.sourceSummary,
          model: input.model,
          promptVersion: input.promptVersion,
          generatedAt: input.generatedAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    return insight;
  }

  async createLlmCallLog(input: InsertLlmCallLog): Promise<LlmCallLog> {
    const [log] = await db.insert(llmCallLogs)
      .values(input)
      .returning();

    return log;
  }

  async markLlmCallLogFailed(logId: number, input: {
    errorStage: string;
    errorMessage: string;
    errorBody?: string | null;
  }): Promise<void> {
    await db.update(llmCallLogs)
      .set({
        status: "error",
        errorStage: input.errorStage,
        errorMessage: input.errorMessage,
        errorBody: input.errorBody ?? null,
      })
      .where(eq(llmCallLogs.id, logId));
  }

  async pruneOldLlmCallLogs(olderThan: Date): Promise<void> {
    await db.delete(llmCallLogs)
      .where(lt(llmCallLogs.createdAt, olderThan));
  }

  async getLlmCallLogs(filters: LlmCallLogFilters): Promise<{ logs: LlmCallLogWithUser[]; total: number }> {
    const whereClause = this.buildLlmCallLogWhere(filters);

    const [{ total }] = await db.select({
      total: sql<number>`count(*)::int`,
    })
    .from(llmCallLogs)
    .where(whereClause);

    const rows = await db.select({
      log: llmCallLogs,
      user: {
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(llmCallLogs)
    .leftJoin(users, eq(llmCallLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(llmCallLogs.createdAt))
    .limit(filters.limit)
    .offset(filters.offset);

    return {
      logs: rows.map((row) => ({
        ...row.log,
        user: this.formatLlmLogUser(row.user),
      })),
      total: Number(total ?? 0),
    };
  }

  async getLlmCallSummary(filters: Omit<LlmCallLogFilters, "limit" | "offset">): Promise<LlmCallSummary> {
    const whereClause = this.buildLlmCallLogWhere(filters);

    const [summary] = await db.select({
      totalCalls: sql<number>`count(*)::int`,
      successfulCalls: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'success')::int`,
      erroredCalls: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
      averageResponseTimeMs: sql<number | null>`round(avg(${llmCallLogs.responseTimeMs}))::int`,
      p95ResponseTimeMs: sql<number | null>`round((percentile_cont(0.95) within group (order by ${llmCallLogs.responseTimeMs}))::numeric)::int`,
      totalInputTokens: sql<number | null>`sum(${llmCallLogs.inputTokens})::int`,
      totalOutputTokens: sql<number | null>`sum(${llmCallLogs.outputTokens})::int`,
      totalTokens: sql<number | null>`sum(${llmCallLogs.totalTokens})::int`,
    })
    .from(llmCallLogs)
    .where(whereClause);

    const byModelRows = await db.select({
      model: llmCallLogs.model,
      totalCalls: sql<number>`count(*)::int`,
      erroredCalls: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
      averageResponseTimeMs: sql<number | null>`round(avg(${llmCallLogs.responseTimeMs}))::int`,
    })
    .from(llmCallLogs)
    .where(whereClause)
    .groupBy(llmCallLogs.model)
    .orderBy(sql`count(*) desc`);

    const recentErrorsWhere = and(
      ...(whereClause ? [whereClause] : []),
      eq(llmCallLogs.status, "error")
    );

    const recentErrors = await db.select({
      errorStage: llmCallLogs.errorStage,
      errorMessage: llmCallLogs.errorMessage,
      count: sql<number>`count(*)::int`,
      lastSeenAt: sql<Date>`max(${llmCallLogs.createdAt})`,
    })
    .from(llmCallLogs)
    .where(recentErrorsWhere)
    .groupBy(llmCallLogs.errorStage, llmCallLogs.errorMessage)
    .orderBy(sql`max(${llmCallLogs.createdAt}) desc`)
    .limit(10);

    return {
      totalCalls: Number(summary?.totalCalls ?? 0),
      successfulCalls: Number(summary?.successfulCalls ?? 0),
      erroredCalls: Number(summary?.erroredCalls ?? 0),
      averageResponseTimeMs: summary?.averageResponseTimeMs == null ? null : Number(summary.averageResponseTimeMs),
      p95ResponseTimeMs: summary?.p95ResponseTimeMs == null ? null : Number(summary.p95ResponseTimeMs),
      totalInputTokens: summary?.totalInputTokens == null ? null : Number(summary.totalInputTokens),
      totalOutputTokens: summary?.totalOutputTokens == null ? null : Number(summary.totalOutputTokens),
      totalTokens: summary?.totalTokens == null ? null : Number(summary.totalTokens),
      byModel: byModelRows.map((row) => ({
        model: row.model,
        totalCalls: Number(row.totalCalls),
        erroredCalls: Number(row.erroredCalls),
        averageResponseTimeMs: row.averageResponseTimeMs == null ? null : Number(row.averageResponseTimeMs),
      })),
      recentErrors: recentErrors.map((row) => ({
        errorStage: row.errorStage,
        errorMessage: row.errorMessage,
        count: Number(row.count),
        lastSeenAt: row.lastSeenAt,
      })),
    };
  }
}

export const storage = new DatabaseStorage();
