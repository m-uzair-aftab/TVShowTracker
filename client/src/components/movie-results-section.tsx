import React from 'react';
import { Movie } from '@shared/schema';
import { Skeleton } from '@/components/ui/skeleton';
import { MovieCard } from './movie-card';

interface MovieResultsSectionProps {
  isLoading: boolean;
  searchPerformed: boolean;
  movies: Movie[];
  searchQuery: string;
  error: string | null;
}

export function MovieResultsSection({
  isLoading,
  searchPerformed,
  movies,
  searchQuery,
  error
}: MovieResultsSectionProps) {
  if (!searchPerformed && !isLoading) {
    return (
      <div className="text-center py-12">
        <i className="ri-film-line text-7xl text-gray-300 mb-4"></i>
        <p className="text-gray-700 text-lg">Search for a movie to get started</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-state fade-in">
        <div className="mb-4 text-secondary">
          <p>Searching for movies...</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-lg overflow-hidden shadow-md">
              <Skeleton className="w-full h-40" />
              <div className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <div className="mt-3">
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state fade-in">
        <div className="bg-red-50 border-l-4 border-error p-4 rounded-md mb-6">
          <div className="flex">
            <i className="ri-error-warning-line flex-shrink-0 text-error text-lg mr-3"></i>
            <div>
              <p className="text-sm text-error">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="empty-results-state fade-in">
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <i className="ri-search-line text-5xl text-gray-300 mb-4"></i>
          <h3 className="text-xl font-medium mb-2">No movies found</h3>
          <p className="text-secondary mb-6">We couldn't find any movies matching "{searchQuery}"</p>
          <p className="text-sm text-secondary">Try checking your spelling or using different keywords</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-state fade-in">
      <div className="mb-6">
        <h3 className="text-xl font-medium">Results for "{searchQuery}"</h3>
        <p className="text-secondary text-sm">{movies.length} movies found</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  );
}
