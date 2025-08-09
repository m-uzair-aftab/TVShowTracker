import { InsertTvShow } from "@shared/schema";

interface TVMazeShow {
  id: number;
  name: string;
  genres: string[];
  status: string;
  premiered: string | null;
  ended: string | null;
  summary: string;
  image: {
    medium: string;
    original: string;
  } | null;
  rating: {
    average: number | null;
  };
  _embedded?: {
    seasons?: Array<{
      id: number;
      number: number;
      episodeOrder: number | null;
    }>;
    episodes?: Array<{
      id: number;
      season: number;
    }>;
  };
}

export async function searchShows(query: string): Promise<InsertTvShow[]> {
  try {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`TVmaze API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // For the top 5 results, fetch detailed info with seasons data
    const topResults = data.slice(0, 5);
    const detailedShows = await Promise.all(
      topResults.map(async (item: { show: TVMazeShow }) => {
        try {
          const detailResponse = await fetch(`https://api.tvmaze.com/shows/${item.show.id}?embed=seasons`);
          if (detailResponse.ok) {
            const detailedShow = await detailResponse.json();
            return mapToInsertTvShow(detailedShow);
          }
        } catch (err) {
          console.error(`Error fetching details for show ${item.show.id}:`, err);
        }
        // Fallback to basic mapping if detailed fetch fails
        return mapToInsertTvShow(item.show);
      })
    );
    
    // Map remaining results without detailed info
    const remainingResults = data.slice(5).map((item: { show: TVMazeShow }) => 
      mapToInsertTvShow(item.show)
    );
    
    return [...detailedShows, ...remainingResults];
  } catch (error) {
    console.error("Error searching shows from TVmaze:", error);
    throw error;
  }
}

export async function getShowDetails(tvMazeId: number): Promise<InsertTvShow> {
  try {
    // Fetch show details with embedded seasons and episodes
    const response = await fetch(`https://api.tvmaze.com/shows/${tvMazeId}?embed[]=seasons&embed[]=episodes`);
    
    if (!response.ok) {
      throw new Error(`TVmaze API error: ${response.status}`);
    }
    
    const show = await response.json();
    return mapToInsertTvShow(show);
  } catch (error) {
    console.error("Error getting show details from TVmaze:", error);
    throw error;
  }
}

function mapToInsertTvShow(show: TVMazeShow): InsertTvShow {
  // Extract year from date strings
  const yearStart = show.premiered ? new Date(show.premiered).getFullYear().toString() : null;
  const yearEnd = show.ended ? new Date(show.ended).getFullYear().toString() : null;
  
  // Count seasons and episodes
  const seasons = show._embedded?.seasons?.length || null;
  
  // Determine total episode count
  let episodes = null;
  if (show._embedded?.episodes) {
    episodes = show._embedded.episodes.length;
  } else if (show._embedded?.seasons) {
    // Sum up episodeOrder from all seasons if available
    episodes = show._embedded.seasons.reduce((total, season) => {
      return total + (season.episodeOrder || 0);
    }, 0);
    // If we got 0, it means no episodes were found, set to null
    if (episodes === 0) episodes = null;
  }
  
  // Extract first genre or use default
  const genre = show.genres && show.genres.length > 0 ? show.genres[0] : null;
  
  // Clean HTML from summary
  const description = show.summary ? show.summary.replace(/<[^>]*>/g, '') : null;
  
  return {
    title: show.name,
    year_start: yearStart || 'Unknown',
    year_end: yearEnd,
    seasons,
    episodes,
    genre,
    rating: show.rating.average ? show.rating.average.toString() : null,
    description,
    poster_url: show.image?.medium || null,
    tvmaze_id: show.id
  };
}