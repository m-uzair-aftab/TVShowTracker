import { InsertMovie } from "@shared/schema";

interface TMDBMovie {
  id: number;
  title: string;
  release_date: string | null;
  overview: string | null;
  poster_path: string | null;
  vote_average: number | null;
  genres?: Array<{ id: number; name: string }>;
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

function getApiKey(): string {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB API key is missing");
  }
  return apiKey;
}

export async function searchMovies(query: string): Promise<InsertMovie[]> {
  try {
    const apiKey = getApiKey();
    const response = await fetch(
      `${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    const results: TMDBMovie[] = data.results || [];

    const topResults = results.slice(0, 5);
    const detailedMovies = await Promise.all(
      topResults.map(async (item) => {
        try {
          const detailResponse = await fetch(
            `${TMDB_BASE_URL}/movie/${item.id}?api_key=${apiKey}`
          );
          if (detailResponse.ok) {
            const detailedMovie = await detailResponse.json();
            return mapToInsertMovie(detailedMovie);
          }
        } catch (err) {
          console.error(`Error fetching details for movie ${item.id}:`, err);
        }
        return mapToInsertMovie(item);
      })
    );

    const remainingResults = results.slice(5).map((item) => mapToInsertMovie(item));

    return [...detailedMovies, ...remainingResults];
  } catch (error) {
    console.error("Error searching movies from TMDB:", error);
    throw error;
  }
}

export async function getMovieDetails(tmdbId: number): Promise<InsertMovie> {
  try {
    const apiKey = getApiKey();
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const movie = await response.json();
    return mapToInsertMovie(movie);
  } catch (error) {
    console.error("Error getting movie details from TMDB:", error);
    throw error;
  }
}

function mapToInsertMovie(movie: TMDBMovie): InsertMovie {
  const releaseYear = movie.release_date
    ? new Date(movie.release_date).getFullYear().toString()
    : "Unknown";

  const genre = movie.genres && movie.genres.length > 0 ? movie.genres[0].name : null;
  const rating = movie.vote_average != null
    ? Math.round(movie.vote_average * 10).toString()
    : null;

  return {
    title: movie.title,
    release_year: releaseYear,
    genre,
    rating,
    description: movie.overview || null,
    poster_url: movie.poster_path ? `${TMDB_POSTER_BASE_URL}${movie.poster_path}` : null,
    tmdb_id: movie.id
  };
}
