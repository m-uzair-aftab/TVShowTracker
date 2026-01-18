import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutGrid, List } from 'lucide-react';

interface MovieActivityData {
  id?: number;
  movieListId?: number;
  dateWatched?: string | null;
  rating?: number | null;
  watchedUsing?: string | null;
}

interface MovieListItem {
  id: number;
  userId: number;
  movieId: number;
  dateAdded: string;
  movie: {
    id: number;
    title: string;
    release_year: string;
    genre: string | null;
    rating: string | null;
    description: string | null;
    poster_url: string | null;
  };
  activity: MovieActivityData | null;
}

interface MyMoviesProps {
  onSwitchToSearch?: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MyMovies({ onSwitchToSearch }: MyMoviesProps) {
  const getSavedPreference = (key: string, defaultValue: string): string => {
    try {
      const savedPrefs = localStorage.getItem('moviesPreferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        return prefs[key] || defaultValue;
      }
    } catch (e) {
      console.error('Error loading saved preferences:', e);
    }
    return defaultValue;
  };

  const saveUserPreferences = (newPrefs: Record<string, string>) => {
    try {
      const existingPrefsStr = localStorage.getItem('moviesPreferences');
      const existingPrefs = existingPrefsStr ? JSON.parse(existingPrefsStr) : {};
      const updatedPrefs = { ...existingPrefs, ...newPrefs };
      localStorage.setItem('moviesPreferences', JSON.stringify(updatedPrefs));
    } catch (e) {
      console.error('Error saving preferences:', e);
    }
  };

  const { data: movies, isLoading, error } = useQuery<MovieListItem[]>({
    queryKey: ['/api/movies/list/mylist'],
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const [yearFilter, setYearFilter] = useState(getSavedPreference('yearFilter', 'all'));
  const [sortBy, setSortBy] = useState(getSavedPreference('sortBy', 'rating'));
  const [sortDirection, setSortDirection] = useState(getSavedPreference('sortDirection', 'desc'));
  const [viewMode, setViewMode] = useState(getSavedPreference('viewMode', 'large'));

  const updateYearFilter = (year: string) => {
    setYearFilter(year);
    saveUserPreferences({ yearFilter: year });
  };

  const updateSortBy = (sort: string) => {
    setSortBy(sort);
    saveUserPreferences({ sortBy: sort });
  };

  const updateSortDirection = (direction: string) => {
    setSortDirection(direction);
    saveUserPreferences({ sortDirection: direction });
  };

  const updateViewMode = (mode: string) => {
    setViewMode(mode);
    saveUserPreferences({ viewMode: mode });
  };

  const filteredMovies = useMemo(() => {
    if (!movies) return [];

    const filtered = yearFilter === 'all'
      ? movies
      : movies.filter((item) => {
          const date = item.activity?.dateWatched;
          if (!date) return false;
          const year = date.slice(0, 4);
          return year === yearFilter;
        });

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.movie.title.localeCompare(b.movie.title);
          break;
        case 'rating': {
          const ratingA = a.activity?.rating ?? 0;
          const ratingB = b.activity?.rating ?? 0;
          comparison = ratingA - ratingB;
          break;
        }
        case 'activity': {
          const dateA = a.activity?.dateWatched ? new Date(`${a.activity.dateWatched}T00:00:00`).getTime() : 0;
          const dateB = b.activity?.dateWatched ? new Date(`${b.activity.dateWatched}T00:00:00`).getTime() : 0;
          comparison = dateB - dateA;
          break;
        }
        default:
          comparison = a.movie.title.localeCompare(b.movie.title);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [movies, yearFilter, sortBy, sortDirection]);

  const exportToCSV = () => {
    const headers = ['Title', 'Date', 'Rating', 'Watched using'];
    const rows = filteredMovies.map(item => [
      item.movie.title,
      formatDate(item.activity?.dateWatched),
      item.activity?.rating ? `${item.activity.rating}/100` : 'Not rated',
      item.activity?.watchedUsing || 'Not set'
    ]);

    const csvContent = [headers, ...rows]
      .map(row =>
        row.map(cell => {
          const cellStr = String(cell || '');
          return cellStr.includes(',') || cellStr.includes('"') ?
            `"${cellStr.replace(/"/g, '""')}"` :
            cellStr;
        }).join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `my-movies-${yearFilter !== 'all' ? yearFilter : 'all-years'}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-40 bg-gray-200">
              <Skeleton className="h-full w-full" />
            </div>
            <CardContent className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-1" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load your movies. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!movies || movies.length === 0) {
    return (
      <div className="text-center py-10">
        <h3 className="text-xl font-medium mb-2">No Movies in Your List</h3>
        <p className="text-gray-600 mb-6">
          You haven't added any movies to your list yet.
        </p>
        <p className="text-gray-600">
          Search for movies and click "Add to My List" to start tracking them.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-col">
            <Label htmlFor="movie-year-filter" className="mb-2">Filter by Year</Label>
            <Select value={yearFilter} onValueChange={updateYearFilter}>
              <SelectTrigger id="movie-year-filter" className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2022">2022</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col">
            <Label htmlFor="movie-sort-by" className="mb-2">Sort by</Label>
            <Select value={sortBy} onValueChange={updateSortBy}>
              <SelectTrigger id="movie-sort-by" className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="rating">Your Avg. Rating</SelectItem>
                <SelectItem value="activity">Last Activity By You</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col">
            <Label htmlFor="movie-sort-direction" className="mb-2">Order</Label>
            <Select value={sortDirection} onValueChange={updateSortDirection}>
              <SelectTrigger id="movie-sort-direction" className="w-full sm:w-[180px]">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="border rounded-md flex">
            <Button
              variant={viewMode === 'large' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => updateViewMode('large')}
              className="flex items-center gap-1"
            >
              <LayoutGrid className="h-4 w-4" /> Large
            </Button>
            <Button
              variant={viewMode === 'medium' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => updateViewMode('medium')}
              className="flex items-center gap-1"
            >
              <LayoutGrid className="h-3 w-3" /> Medium
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => updateViewMode('table')}
              className="flex items-center gap-1"
            >
              <List className="h-4 w-4" /> List
            </Button>
          </div>

          {viewMode === 'table' && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="flex items-center gap-1"
            >
              <i className="ri-download-line mr-1"></i>
              Export to CSV
            </Button>
          )}
        </div>
      </div>

      {filteredMovies.length > 0 && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredMovies.length} {filteredMovies.length === 1 ? 'movie' : 'movies'}
          {yearFilter !== 'all' && ` with activity in ${yearFilter}`}
        </div>
      )}

      {filteredMovies.length === 0 && yearFilter !== 'all' && (
        <div className="text-center py-8 bg-muted/20 rounded-lg">
          <h3 className="text-lg font-medium mb-2">No Movies Found</h3>
          <p className="text-muted-foreground">
            None of your movies have tracking activity in {yearFilter}.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => updateYearFilter('all')}
          >
            Show All Years
          </Button>
        </div>
      )}

      {viewMode === 'large' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMovies.map((item) => (
            <MovieListCard
              key={item.id}
              item={item}
            />
          ))}
        </div>
      )}

      {viewMode === 'medium' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMovies.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <Link href={`/movie/${item.movie.id}?source=mylist`}>
                <div className="h-36 bg-gray-100 overflow-hidden cursor-pointer">
                  {item.movie.poster_url ? (
                    <img
                      src={item.movie.poster_url}
                      alt={item.movie.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://via.placeholder.com/300x200?text=${encodeURIComponent(item.movie.title)}`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center p-2">
                        <i className="ri-image-line text-xl text-gray-400 mb-1"></i>
                        <p className="text-xs text-gray-500">No image</p>
                      </div>
                    </div>
                  )}
                </div>
              </Link>

              <CardContent className="p-3">
                <Link href={`/movie/${item.movie.id}?source=mylist`}>
                  <h3 className="font-medium text-sm mb-1 cursor-pointer hover:text-primary transition-colors line-clamp-1">
                    {item.movie.title}
                  </h3>
                </Link>

                <div className="text-xs text-gray-600 mb-1">
                  Date: {formatDate(item.activity?.dateWatched)}
                </div>
                <div className="text-xs text-gray-600">
                  Rating: {item.activity?.rating ? `${item.activity.rating}/100` : 'Not rated'}
                </div>
                <div className="text-xs text-gray-600">
                  Watched using: {item.activity?.watchedUsing || 'Not set'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-center font-medium">Date</th>
                <th className="px-4 py-3 text-center font-medium">Rating</th>
                <th className="px-4 py-3 text-center font-medium">Watched using</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovies.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <Link href={`/movie/${item.movie.id}?source=mylist`} className="hover:text-primary font-medium">
                      {item.movie.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {formatDate(item.activity?.dateWatched)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.activity?.rating ? `${item.activity.rating}/100` : 'Not rated'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.activity?.watchedUsing || 'Not set'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-center py-8 mt-4 border-t border-gray-100">
        <p className="text-gray-600">
          Want to track more movies? <button
            onClick={() => {
              window.history.replaceState(null, '', '/movies/search');
              if (onSwitchToSearch) onSwitchToSearch();
              window.scrollTo(0, 0);
            }}
            className="text-primary font-medium hover:underline cursor-pointer bg-transparent border-none p-0 inline">
            Add more movies by searching
          </button>
        </p>
      </div>
    </div>
  );
}

function MovieListCard({
  item,
}: {
  item: MovieListItem;
}) {
  return (
    <Card className="overflow-hidden">
      <Link href={`/movie/${item.movie.id}?source=mylist`}>
        <div className="h-48 bg-gray-100 overflow-hidden cursor-pointer">
          {item.movie.poster_url ? (
            <img
              src={item.movie.poster_url}
              alt={item.movie.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://via.placeholder.com/500x300?text=${encodeURIComponent(item.movie.title)}`;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center p-4">
                <i className="ri-image-line text-3xl text-gray-400 mb-2"></i>
                <p className="text-sm text-gray-500">No image available</p>
              </div>
            </div>
          )}
        </div>
      </Link>

      <CardContent className="p-4">
        <Link href={`/movie/${item.movie.id}?source=mylist`}>
          <h3 className="font-semibold text-lg mb-1 cursor-pointer hover:text-primary transition-colors">
            {item.movie.title}
          </h3>
        </Link>

        <div className="flex justify-between items-center mb-3">
          <div className="text-sm text-gray-600">
            {item.movie.release_year}
          </div>
          {item.movie.genre && (
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
              {item.movie.genre}
            </span>
          )}
        </div>

        <div className="grid gap-2 text-sm text-gray-700">
          <div>
            <span className="font-medium">Date:</span> {formatDate(item.activity?.dateWatched)}
          </div>
          <div>
            <span className="font-medium">Rating:</span> {item.activity?.rating ? `${item.activity.rating}/100` : 'Not rated'}
          </div>
          <div>
            <span className="font-medium">Watched using:</span> {item.activity?.watchedUsing || 'Not set'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
