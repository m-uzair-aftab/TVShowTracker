import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from 'bcrypt';
import { storage } from "./storage";
import { setupAuth, authHybrid } from "./auth";
import { 
  searchTvShowSchema, 
  insertTvShowSchema, 
  seasonProgressValidationSchema,
  searchMovieSchema,
  insertMovieSchema,
  movieActivityValidationSchema
} from "@shared/schema";
import { z } from "zod";
import { searchShows, getShowDetails } from "./tvmaze-api";
import { searchMovies, getMovieDetails } from "./tmdb-api";

const reservedUsernames = new Set([
  "auth",
  "api",
  "movies",
  "movie",
  "show",
  "search",
  "settings",
  "share",
  "health",
]);

const usernameSchema = z.string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be 32 characters or less")
  .regex(/^[a-z0-9-]+$/, "Username can only use lowercase letters, numbers, and hyphens")
  .refine((value) => !value.startsWith("-") && !value.endsWith("-"), {
    message: "Username cannot start or end with a hyphen",
  })
  .refine((value) => !reservedUsernames.has(value), {
    message: "That username is reserved",
  });

const shareSettingsUpdateSchema = z.object({
  username: z.string().trim().optional(),
  enabled: z.boolean().optional(),
  includeAllYears: z.boolean().optional(),
  sharedYears: z.array(z.string().regex(/^\d{4}$/)).optional(),
});

type SeasonProgressData = {
  seasonNumber: number;
  startDate?: string | Date | null;
  finishDate?: string | Date | null;
  rating?: number | null;
};

function getYear(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return value.getFullYear().toString();
  return value.slice(0, 4);
}

function seasonMatchesYears(season: SeasonProgressData, years: Set<string>) {
  const startYear = getYear(season.startDate);
  const finishYear = getYear(season.finishDate);
  return (startYear !== null && years.has(startYear)) || (finishYear !== null && years.has(finishYear));
}

function getWatchedSeasonsList(seasons: SeasonProgressData[]) {
  const watched = seasons
    .filter((season) => season.startDate || season.finishDate)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((season) => `S${season.seasonNumber}`);

  return watched.length > 0 ? watched.join(", ") : "None";
}

function calculateAverageRating(seasons: SeasonProgressData[]) {
  const ratings = seasons
    .map((season) => season.rating)
    .filter((rating): rating is number => rating != null);

  if (ratings.length === 0) return null;
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return Math.round(sum / ratings.length);
}

function calculateGrade(rating: number | null) {
  if (rating === null || rating === 0) return null;
  if (rating > 90) return "A+";
  if (rating >= 85) return "A";
  if (rating >= 75) return "A-";
  if (rating >= 65) return "B+";
  if (rating >= 55) return "B";
  if (rating >= 45) return "B-";
  if (rating >= 40) return "C";
  if (rating >= 30) return "C-";
  if (rating >= 10) return "D";
  return "E";
}

function compareNullableRatings(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  if (process.env.SEED_DEMO_DATA === "true") {
    await initializeSampleData();
  }

  app.get("/api/share-settings", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      const settings = await storage.getUserShareSettings(userId);
      const availableYears = await storage.getUserActivityYears(userId);

      res.json({
        username: user?.username ?? "",
        enabled: settings?.enabled ?? false,
        includeAllYears: settings?.includeAllYears ?? true,
        sharedYears: settings?.sharedYears ?? [],
        availableYears,
        publicPath: user?.username ? `/${user.username}/shared-list` : null,
      });
    } catch (error) {
      console.error("Error getting share settings:", error);
      res.status(500).json({ message: "Failed to retrieve share settings" });
    }
  });

  app.patch("/api/share-settings", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      const parsed = shareSettingsUpdateSchema.parse(req.body);
      const availableYears = await storage.getUserActivityYears(userId);
      const availableYearSet = new Set(availableYears);

      let nextUsername = currentUser.username ?? "";
      if (parsed.username !== undefined) {
        nextUsername = parsed.username.trim().toLowerCase();
        if (nextUsername) {
          nextUsername = usernameSchema.parse(nextUsername);
          const existingUser = await storage.getUserByUsername(nextUsername);
          if (existingUser && existingUser.id !== userId) {
            return res.status(409).json({ message: "That username is already taken" });
          }
        }
      }

      const currentSettings = await storage.getOrCreateUserShareSettings(userId);
      const nextEnabled = parsed.enabled ?? currentSettings.enabled;
      const nextIncludeAllYears = parsed.includeAllYears ?? currentSettings.includeAllYears;
      const nextSharedYears = parsed.sharedYears !== undefined
        ? Array.from(new Set(parsed.sharedYears)).filter((year) => availableYearSet.has(year)).sort((a, b) => Number(b) - Number(a))
        : currentSettings.sharedYears;

      if (nextEnabled && !nextUsername) {
        return res.status(400).json({ message: "Choose a username before turning sharing on" });
      }

      if (nextEnabled && !nextIncludeAllYears && nextSharedYears.length === 0) {
        return res.status(400).json({ message: "Choose at least one year or share all years" });
      }

      if (parsed.username !== undefined && nextUsername !== currentUser.username) {
        await storage.updateUserUsername(userId, nextUsername || null);
      }

      const updatedSettings = await storage.updateUserShareSettings(userId, {
        enabled: nextEnabled,
        includeAllYears: nextIncludeAllYears,
        sharedYears: nextSharedYears,
      });

      res.json({
        username: nextUsername,
        enabled: updatedSettings.enabled,
        includeAllYears: updatedSettings.includeAllYears,
        sharedYears: updatedSettings.sharedYears,
        availableYears,
        publicPath: nextUsername ? `/${nextUsername}/shared-list` : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }

      console.error("Error updating share settings:", error);
      res.status(500).json({ message: "Failed to update share settings" });
    }
  });

  app.get("/api/shared-list/:username", async (req, res) => {
    try {
      const username = usernameSchema.parse(req.params.username);
      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(404).json({ message: "Shared list not found" });
      }

      const settings = await storage.getUserShareSettings(user.id);
      if (!settings?.enabled) {
        return res.status(404).json({ message: "Shared list not found" });
      }

      const availableYears = await storage.getUserActivityYears(user.id);
      const requestedYear = typeof req.query.year === "string" && /^\d{4}$/.test(req.query.year)
        ? req.query.year
        : null;
      const activeYear = settings.includeAllYears && requestedYear && availableYears.includes(requestedYear)
        ? requestedYear
        : null;
      const selectedYears = new Set(activeYear ? [activeYear] : settings.sharedYears);
      const shouldFilterByYear = Boolean(activeYear) || !settings.includeAllYears;
      const tvShows = await storage.getUserWatchlistWithActivity(user.id);
      const movies = await storage.getUserMovieListWithActivity(user.id);

      const sharedShows = tvShows
        .map((item) => {
          const visibleSeasons = shouldFilterByYear
            ? item.seasons.filter((season) => seasonMatchesYears(season, selectedYears))
            : item.seasons;

          if (shouldFilterByYear && visibleSeasons.length === 0) {
            return null;
          }

          const averageRating = calculateAverageRating(
            visibleSeasons.filter((season) => season.startDate || season.finishDate)
          );

          return {
            id: item.show.id,
            title: item.show.title,
            yearStart: item.show.year_start,
            yearEnd: item.show.year_end,
            genre: item.show.genre,
            posterUrl: item.show.poster_url,
            description: item.show.description,
            watched: getWatchedSeasonsList(visibleSeasons),
            averageRating,
            grade: calculateGrade(averageRating),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => compareNullableRatings(a.averageRating, b.averageRating) || a.title.localeCompare(b.title));

      const sharedMovies = movies
        .filter((item) => {
          if (!shouldFilterByYear) return true;
          const watchedYear = item.activity?.dateWatched?.slice(0, 4);
          return watchedYear ? selectedYears.has(watchedYear) : false;
        })
        .map((item) => ({
          id: item.movie.id,
          title: item.movie.title,
          releaseYear: item.movie.release_year,
          genre: item.movie.genre,
          posterUrl: item.movie.poster_url,
          description: item.movie.description,
          rating: item.activity?.rating ?? null,
        }))
        .sort((a, b) => compareNullableRatings(a.rating, b.rating) || a.title.localeCompare(b.title));

      const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Shared";

      res.json({
        owner: {
          username: user.username,
          displayName,
        },
        includeAllYears: settings.includeAllYears,
        sharedYears: settings.sharedYears,
        availableYears,
        selectedYear: activeYear,
        tvShows: sharedShows,
        movies: sharedMovies,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(404).json({ message: "Shared list not found" });
      }

      console.error("Error getting shared list:", error);
      res.status(500).json({ message: "Failed to retrieve shared list" });
    }
  });
  
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

  // Search Movies
  app.get("/api/movies/search", async (req, res) => {
    try {
      const parsedQuery = searchMovieSchema.parse({
        query: req.query.query,
      });

      if (!parsedQuery.query) {
        const movies = await storage.getAllMovies();
        return res.json(movies);
      }

      const apiMovies = await searchMovies(parsedQuery.query);
      const existingMovies = await storage.getAllMovies();
      const results = [];

      for (const apiMovie of apiMovies) {
        let existingMovie: typeof existingMovies[0] | undefined;

        if (apiMovie.tmdb_id) {
          existingMovie = existingMovies.find(
            movie => movie.tmdb_id === apiMovie.tmdb_id
          );
        }

        if (!existingMovie && !apiMovie.tmdb_id) {
          existingMovie = existingMovies.find(
            movie => movie.title.toLowerCase() === apiMovie.title.toLowerCase()
          );
        }

        if (existingMovie) {
          const updatedMovie = await storage.updateMovie(existingMovie.id, apiMovie);
          results.push(updatedMovie || existingMovie);
        } else {
          const newMovie = await storage.createMovie(apiMovie);
          results.push(newMovie);
        }
      }

      res.json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Movie search error:", error);
      res.status(500).json({ message: "Failed to search for movies" });
    }
  });

  // Get Movie by ID
  app.get("/api/movies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const movie = await storage.getMovie(id);
      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      if (movie.tmdb_id) {
        try {
          const updatedMovieData = await getMovieDetails(movie.tmdb_id);
          const updatedMovie = await storage.updateMovie(id, updatedMovieData);
          return res.json(updatedMovie || movie);
        } catch (apiError) {
          console.warn("Could not update movie from TMDB API:", apiError);
          return res.json(movie);
        }
      }

      res.json(movie);
    } catch (error) {
      console.error("Error retrieving movie:", error);
      res.status(500).json({ message: "Failed to retrieve movie" });
    }
  });

  // Create Movie route (for future use)
  app.post("/api/movies", async (req, res) => {
    try {
      const newMovie = insertMovieSchema.parse(req.body);
      const movie = await storage.createMovie(newMovie);
      res.status(201).json(movie);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create movie" });
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

  // Movie list routes
  app.post("/api/movies/list", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const { movieId } = req.body;

      if (!movieId || typeof movieId !== 'number') {
        return res.status(400).json({ message: "Valid movie ID is required" });
      }

      const movie = await storage.getMovie(movieId);
      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      const listItem = await storage.addToMovieList(userId, movieId);
      res.status(201).json(listItem);
    } catch (error) {
      console.error("Error adding movie to list:", error);
      res.status(500).json({ message: "Failed to add movie to list" });
    }
  });

  app.get("/api/movies/list", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const list = await storage.getUserMovieList(userId);
      res.json(list);
    } catch (error) {
      console.error("Error getting movie list:", error);
      res.status(500).json({ message: "Failed to retrieve movie list" });
    }
  });

  app.get("/api/movies/list/mylist", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const listWithActivity = await storage.getUserMovieListWithActivity(userId);
      res.json(listWithActivity);
    } catch (error) {
      console.error("Error getting movie list with activity:", error);
      res.status(500).json({ message: "Failed to retrieve movie list" });
    }
  });

  app.get("/api/movies/list/check/:movieId", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const movieId = parseInt(req.params.movieId, 10);

      if (isNaN(movieId)) {
        return res.status(400).json({ message: "Invalid movie ID" });
      }

      const listItem = await storage.getMovieListItem(userId, movieId);
      res.json({ inList: !!listItem, listItem });
    } catch (error) {
      console.error("Error checking movie list status:", error);
      res.status(500).json({ message: "Failed to check movie list status" });
    }
  });

  app.delete("/api/movies/list/:movieId", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const movieId = parseInt(req.params.movieId, 10);

      if (isNaN(movieId)) {
        return res.status(400).json({ message: "Invalid movie ID" });
      }

      const removed = await storage.removeFromMovieList(userId, movieId);
      res.json({ success: removed });
    } catch (error) {
      console.error("Error removing movie from list:", error);
      res.status(500).json({ message: "Failed to remove movie from list" });
    }
  });

  app.get("/api/movies/list/:movieId/activity", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const movieId = parseInt(req.params.movieId, 10);

      if (isNaN(movieId)) {
        return res.status(400).json({ message: "Invalid movie ID" });
      }

      const listItem = await storage.getMovieListItem(userId, movieId);
      if (!listItem) {
        return res.status(404).json({ message: "Movie not in list" });
      }

      const activity = await storage.getMovieActivity(listItem.id);
      res.json(activity || null);
    } catch (error) {
      console.error("Error getting movie activity:", error);
      res.status(500).json({ message: "Failed to get movie activity" });
    }
  });

  app.post("/api/movies/list/:movieId/activity", authHybrid, async (req, res) => {
    try {
      const userId = req.userId!;
      const movieId = parseInt(req.params.movieId, 10);

      if (isNaN(movieId)) {
        return res.status(400).json({ message: "Invalid movie ID" });
      }

      const listItem = await storage.getMovieListItem(userId, movieId);
      if (!listItem) {
        return res.status(404).json({ message: "Movie not in list" });
      }

      const parsedActivity = movieActivityValidationSchema.parse(req.body);
      const updated = await storage.updateMovieActivity(listItem.id, parsedActivity);
      res.json(updated);
    } catch (error) {
      console.error("Error updating movie activity:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }

      res.status(500).json({ message: "Failed to update movie activity" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Initialize sample data for the application
async function initializeSampleData() {
  let demoUser;
  try {
    demoUser = await storage.getUserByEmail("user@example.com");
    if (!demoUser) {
      console.log("Demo user not found, creating one...");
      const demoPassword = process.env.DEMO_USER_PASSWORD;
      if (!demoPassword) {
        throw new Error("DEMO_USER_PASSWORD must be set when SEED_DEMO_DATA=true");
      }
      const hashedPassword = await bcrypt.hash(demoPassword, 10);
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
