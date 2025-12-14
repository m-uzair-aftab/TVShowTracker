import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from 'bcrypt';
import { storage } from "./storage";
import { setupAuth, authHybrid } from "./auth";
import { 
  searchTvShowSchema, 
  insertTvShowSchema, 
  insertUserWatchlistSchema,
  insertSeasonProgressSchema,
  seasonProgressValidationSchema
} from "@shared/schema";
import { z } from "zod";
import { searchShows, getShowDetails } from "./tvmaze-api";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Initialize sample data
  await initializeSampleData();
  
  // Search TV shows
  app.get("/api/tv-shows/search", async (req, res) => {
    try {
      const parsedQuery = searchTvShowSchema.parse({
        query: req.query.query,
      });
      
      if (!parsedQuery.query) {
        // If no query provided, return all shows from our database
        const shows = await storage.getAllTvShows();
        return res.json(shows);
      }
      
      // Search shows from TVmaze API
      const apiShows = await searchShows(parsedQuery.query);
      
      // First check if we have these shows in our database 
      const existingShows = await storage.getAllTvShows();
      const results = [];
      
      // Process each show from the API
      for (const apiShow of apiShows) {
        // Check if show already exists in our database
        // Priority: match by tvmaze_id first (if available), then by title (only if no tvmaze_id)
        let existingShow: typeof existingShows[0] | undefined;
        
        if (apiShow.tvmaze_id) {
          // If API show has tvmaze_id, match by tvmaze_id first
          existingShow = existingShows.find(
            show => show.tvmaze_id === apiShow.tvmaze_id
          );
        }
        
        // If no match by tvmaze_id and API show doesn't have tvmaze_id, try matching by title
        // (We don't match by title if tvmaze_id exists to avoid overwriting different shows with same title)
        if (!existingShow && !apiShow.tvmaze_id) {
          existingShow = existingShows.find(
            show => show.title.toLowerCase() === apiShow.title.toLowerCase()
          );
        }
        
        if (existingShow) {
          // If already in database, update it with the latest API data
          // This ensures we always have the most current data and images
          const updatedShow = await storage.updateTvShow(existingShow.id, apiShow);
          results.push(updatedShow || existingShow);
        } else {
          // If not in database, save it and add to results
          const newShow = await storage.createTvShow(apiShow);
          results.push(newShow);
        }
      }
      
      res.json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("TV show search error:", error);
      res.status(500).json({ message: "Failed to search for TV shows" });
    }
  });

  // Get TV show by ID
  app.get("/api/tv-shows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      // Get show from our database
      const show = await storage.getTvShow(id);
      if (!show) {
        return res.status(404).json({ message: "TV show not found" });
      }
      
      // If show has a tvmaze_id, fetch fresh data from TVmaze API
      if (show.tvmaze_id) {
        try {
          // Get updated details from TVmaze
          const updatedShowData = await getShowDetails(show.tvmaze_id);
          
          // Update our stored data with the latest from TVmaze
          const updatedShow = await storage.updateTvShow(id, updatedShowData);
          return res.json(updatedShow || show);
        } catch (apiError) {
          console.warn("Could not update show from TVmaze API:", apiError);
          // If API call fails, return the data we have stored
          return res.json(show);
        }
      }
      
      // If no tvmaze_id or API update fails, return our stored data
      res.json(show);
    } catch (error) {
      console.error("Error retrieving TV show:", error);
      res.status(500).json({ message: "Failed to retrieve TV show" });
    }
  });

  // Create TV show route (for future use)
  app.post("/api/tv-shows", async (req, res) => {
    try {
      const newShow = insertTvShowSchema.parse(req.body);
      const show = await storage.createTvShow(newShow);
      res.status(201).json(show);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create TV show" });
    }
  });

  // Watchlist routes
  
  // Add show to watchlist
  app.post("/api/watchlist", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const { showId } = req.body;
      
      if (!showId || typeof showId !== 'number') {
        return res.status(400).json({ message: "Valid show ID is required" });
      }
      
      // Check if show exists
      const show = await storage.getTvShow(showId);
      if (!show) {
        return res.status(404).json({ message: "TV show not found" });
      }
      
      // Add to watchlist
      const watchlistItem = await storage.addToWatchlist(userId, showId);
      res.status(201).json(watchlistItem);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ message: "Failed to add show to watchlist" });
    }
  });
  
  // Get user's watchlist
  app.get("/api/watchlist", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      
      const watchlist = await storage.getUserWatchlist(userId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error getting watchlist:", error);
      res.status(500).json({ message: "Failed to retrieve watchlist" });
    }
  });
  
  // Get user's watchlist with activity dates and season progress - for My TV Shows tab
  app.get("/api/watchlist/myshows", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      
      const watchlistWithActivity = await storage.getUserWatchlistWithActivity(userId);
      res.json(watchlistWithActivity);
    } catch (error) {
      console.error("Error getting watchlist with activity:", error);
      res.status(500).json({ message: "Failed to retrieve watchlist with activity" });
    }
  });
  
  // Check if show is in watchlist
  app.get("/api/watchlist/check/:showId", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const showId = parseInt(req.params.showId);
      
      if (isNaN(showId)) {
        return res.status(400).json({ message: "Invalid show ID" });
      }
      
      const watchlistItem = await storage.getWatchlistItem(userId, showId);
      res.json({ inWatchlist: !!watchlistItem, watchlistItem });
    } catch (error) {
      console.error("Error checking watchlist:", error);
      res.status(500).json({ message: "Failed to check watchlist status" });
    }
  });
  
  // Remove from watchlist
  app.delete("/api/watchlist/:showId", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const showId = parseInt(req.params.showId);
      
      if (isNaN(showId)) {
        return res.status(400).json({ message: "Invalid show ID" });
      }
      
      const removed = await storage.removeFromWatchlist(userId, showId);
      res.json({ success: removed });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });
  
  // Season progress routes
  
  // Get season progress for a show
  app.get("/api/watchlist/:showId/progress", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const showId = parseInt(req.params.showId);
      
      if (isNaN(showId)) {
        return res.status(400).json({ message: "Invalid show ID" });
      }
      
      // Get watchlist item
      const watchlistItem = await storage.getWatchlistItem(userId, showId);
      if (!watchlistItem) {
        return res.status(404).json({ message: "Show not in watchlist" });
      }
      
      // Get progress for all seasons
      const progress = await storage.getSeasonProgress(watchlistItem.id);
      res.json(progress);
    } catch (error) {
      console.error("Error getting season progress:", error);
      res.status(500).json({ message: "Failed to get season progress" });
    }
  });
  
  // Update season progress
  app.post("/api/watchlist/:showId/progress/:seasonNumber", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const showId = parseInt(req.params.showId);
      const seasonNumber = parseInt(req.params.seasonNumber);
      
      if (isNaN(showId) || isNaN(seasonNumber)) {
        return res.status(400).json({ message: "Invalid show ID or season number" });
      }
      
      // Get watchlist item
      const watchlistItem = await storage.getWatchlistItem(userId, showId);
      if (!watchlistItem) {
        return res.status(404).json({ message: "Show not in watchlist" });
      }
      
      // Validate progress data
      const progressData = req.body;
      
      // Convert date strings to Date objects if they exist
      if (progressData.startDate) {
        progressData.startDate = new Date(progressData.startDate);
      }
      
      if (progressData.finishDate) {
        progressData.finishDate = new Date(progressData.finishDate);
      }
      
      // Update progress
      const updatedProgress = await storage.updateSeasonProgress(
        watchlistItem.id,
        seasonNumber,
        progressData
      );
      
      res.json(updatedProgress);
    } catch (error) {
      console.error("Error updating season progress:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      
      res.status(500).json({ message: "Failed to update season progress" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Initialize sample data for the application
async function initializeSampleData() {
  // A demo user has already been created in our database migration
  // This will be email: user@example.com with password: demo-password
  // The migration created the user with bcrypt hashed password
  let demoUser;
  try {
    demoUser = await storage.getUserByEmail("user@example.com");
    if (!demoUser) {
      console.log("Demo user not found, creating one...");
      const hashedPassword = await bcrypt.hash("demo-password", 10);
      demoUser = await storage.createUser({ 
        email: "user@example.com", 
        password: hashedPassword,
        firstName: "Demo",
        lastName: "User"
      });
    }
  } catch (error) {
    console.error("Error getting/creating demo user:", error);
  }

  const shows = await storage.getAllTvShows();
  
  // Only add sample data if the database is empty
  if (shows.length === 0) {
    const sampleShows = [
      {
        title: "Breaking Bad",
        year_start: "2008",
        year_end: "2013",
        seasons: 5,
        episodes: 62,
        genre: "Drama",
        rating: "9.5",
        description: "A high school chemistry teacher turned methamphetamine producer partners with a former student to secure his family's financial future.",
        poster_url: "https://m.media-amazon.com/images/M/MV5BYmQ4YWMxYjUtNjZmYi00MDQ1LWFjMjMtNjA5ZDdiYjdiODU5XkEyXkFqcGdeQXVyMTMzNDExODE5._V1_.jpg"
      },
      {
        title: "Better Call Saul",
        year_start: "2015",
        year_end: "2022",
        seasons: 6,
        episodes: 63,
        genre: "Drama",
        rating: "8.9",
        description: "The trials and tribulations of criminal lawyer Jimmy McGill before his transformation into Saul Goodman.",
        poster_url: "https://m.media-amazon.com/images/M/MV5BZDA4YmE0OTYtMmRmNS00Mzk2LTlhM2MtNjk4NzBjZGE1MmIyXkEyXkFqcGdeQXVyMTMzNDExODE5._V1_.jpg"
      },
      {
        title: "Stranger Things",
        year_start: "2016",
        year_end: null,
        seasons: 4,
        episodes: 34,
        genre: "Sci-Fi",
        rating: "8.7",
        description: "When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces in order to get him back.",
        poster_url: "https://m.media-amazon.com/images/M/MV5BN2ZmYjg1YmItNWQ4OC00YWM0LWE0ZDktYThjOTZiZjhhN2Q2XkEyXkFqcGdeQXVyNjgxNTQ3Mjk@._V1_.jpg"
      },
      {
        title: "Game of Thrones",
        year_start: "2011",
        year_end: "2019",
        seasons: 8,
        episodes: 73,
        genre: "Fantasy",
        rating: "9.2",
        description: "Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.",
        poster_url: "https://m.media-amazon.com/images/M/MV5BN2IzYzBiOTQtNGZmMi00NDI5LTgxMzMtN2EzZjA1NjhlOGMxXkEyXkFqcGdeQXVyNjAwNDk3ODk@._V1_.jpg"
      },
      {
        title: "The Office",
        year_start: "2005",
        year_end: "2013",
        seasons: 9,
        episodes: 201,
        genre: "Comedy",
        rating: "8.9",
        description: "A mockumentary on a group of typical office workers, where the workday consists of ego clashes, inappropriate behavior, and tedium.",
        poster_url: "https://m.media-amazon.com/images/M/MV5BMDNkOTE4NDQtMTNmYi00MWE0LWE4ZTktYTc0NzhhNWIzNzJiXkEyXkFqcGdeQXVyMzQ2MDI5NjU@._V1_.jpg"
      },
      {
        title: "Friends",
        year_start: "1994",
        year_end: "2004",
        seasons: 10,
        episodes: 236,
        genre: "Comedy",
        rating: "8.8",
        description: "Follows the personal and professional lives of six twenty to thirty-something-year-old friends living in Manhattan.",
        poster_url: "https://m.media-amazon.com/images/M/MV5BNDVkYjU0MzctMWRmZi00NTkxLTgwZWEtOWVhYjZlYjllYmU4XkEyXkFqcGdeQXVyNTA4NzY1MzY@._V1_.jpg"
      },
      {
        title: "The Mandalorian",
        year_start: "2019",
        year_end: null,
        seasons: 3,
        episodes: 24,
        genre: "Sci-Fi",
        rating: "8.7",
        description: "The travels of a lone bounty hunter in the outer reaches of the galaxy, far from the authority of the New Republic.",
        poster_url: "https://m.media-amazon.com/images/M/MV5BN2M5YWFjN2YtYzU2YS00NzBlLTgwZWUtYWQzNWFhNDkyYjg3XkEyXkFqcGdeQXVyMDM2NDM2MQ@@._V1_.jpg"
      },
      {
        title: "The Crown",
        year_start: "2016",
        year_end: "2023",
        seasons: 6,
        episodes: 60,
        genre: "Drama",
        rating: "8.7",
        description: "Follows the political rivalries and romance of Queen Elizabeth II's reign and the events that shaped the second half of the twentieth century.",
        poster_url: "https://m.media-amazon.com/images/M/MV5BZWNiODE0MzctOGQ5Ny00YjdlLTllNGQtNTk5NmUxNGU1ZDY0XkEyXkFqcGdeQXVyMTkxNjUyNQ@@._V1_.jpg"
      }
    ];

    for (const show of sampleShows) {
      await storage.createTvShow(show);
    }
  }
}
