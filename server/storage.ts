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
  type AiTasteProfile, type AiInsightSourceSummary
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, sql } from "drizzle-orm";

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
  updateUserShareSettings(userId: number, settings: Partial<Pick<UserShareSettings, "enabled" | "includeAllYears" | "sharedYears">>): Promise<UserShareSettings>;
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
}

export class DatabaseStorage implements IStorage {
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
    // First get all watchlist items with their shows
    const watchlistItems = await this.getUserWatchlist(userId);
    
    // Then for each watchlist item, get the season progress data
    const result = await Promise.all(watchlistItems.map(async (item) => {
      const seasons = await this.getSeasonProgress(item.id);
      
      // Calculate the last activity date (latest start or finish date across all seasons)
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
    }));
    
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
      })
      .returning();

    return created;
  }

  async updateUserShareSettings(
    userId: number,
    settings: Partial<Pick<UserShareSettings, "enabled" | "includeAllYears" | "sharedYears">>
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
}

export const storage = new DatabaseStorage();
