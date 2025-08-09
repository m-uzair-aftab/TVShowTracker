import { 
  tvShows, type TvShow, type InsertTvShow, 
  users, type User, type InsertUser,
  userWatchlists, type UserWatchlist, type InsertUserWatchlist,
  seasonProgress, type SeasonProgress, type InsertSeasonProgress
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // TV Show methods
  getAllTvShows(): Promise<TvShow[]>;
  searchTvShows(query: string): Promise<TvShow[]>;
  getTvShow(id: number): Promise<TvShow | undefined>;
  createTvShow(show: InsertTvShow): Promise<TvShow>;
  updateTvShow(id: number, show: Partial<InsertTvShow>): Promise<TvShow | undefined>;
  deleteTvShow(id: number): Promise<boolean>;
  
  // Watchlist methods
  addToWatchlist(userId: number, showId: number): Promise<UserWatchlist>;
  removeFromWatchlist(userId: number, showId: number): Promise<boolean>;
  getUserWatchlist(userId: number): Promise<(UserWatchlist & { show: TvShow })[]>;
  getWatchlistItem(userId: number, showId: number): Promise<UserWatchlist | undefined>;
  
  // Season progress methods
  getSeasonProgress(watchlistId: number, seasonNumber?: number): Promise<SeasonProgress[]>;
  updateSeasonProgress(watchlistId: number, seasonNumber: number, progress: Partial<InsertSeasonProgress>): Promise<SeasonProgress>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // This is kept for backward compatibility but now uses email
    // Since we've updated the schema to use email instead of username
    const result = await db.select().from(users).where(eq(users.email, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
}

export const storage = new DatabaseStorage();
