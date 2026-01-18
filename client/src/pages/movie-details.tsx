import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, Link, useLocation } from 'wouter';
import { Movie } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { MovieWatchlistManager } from '@/components/movie-watchlist-manager';

export default function MovieDetails() {
  const [, params] = useRoute('/movie/:id');
  const [, navigate] = useLocation();
  const id = params?.id;

  const handleGoBack = (e: React.MouseEvent) => {
    e.preventDefault();
    const source = new URLSearchParams(window.location.search).get('source') || 'mylist';
    if (source === 'search') {
      navigate('/movies/search');
    } else {
      navigate('/movies');
    }
  };

  const { data: movie, isLoading: loading, error } = useQuery<Movie, Error>({
    queryKey: [`/api/movies/${id}`],
    enabled: !!id,
  });

  if (!id) {
    return <div>Invalid movie ID</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-4" asChild>
            <Link href="/movies" className="inline-flex items-center">
              <i className="ri-arrow-left-line mr-1"></i> Back
            </Link>
          </Button>

          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3">
              <Skeleton className="w-full aspect-[2/3] rounded-lg" />
            </div>
            <div className="w-full md:w-2/3">
              <Skeleton className="h-8 w-2/3 mb-2" />
              <Skeleton className="h-4 w-1/3 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-4" asChild>
            <Link href="/movies" className="inline-flex items-center">
              <i className="ri-arrow-left-line mr-1"></i> Back
            </Link>
          </Button>

          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <p className="text-red-700">
                Error loading movie details. Please try again later.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" className="mb-6 text-lg" onClick={handleGoBack}>
          <i className="ri-arrow-left-line mr-2"></i> Back
        </Button>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 mb-6 md:mb-0">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <img
                src={movie.poster_url || 'https://via.placeholder.com/500x750?text=No+Image+Available'}
                alt={movie.title}
                className="w-full rounded-md object-cover aspect-[2/3]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/500x750?text=Image+Error';
                }}
              />
            </div>
          </div>

          <div className="w-full md:w-2/3">
            <div className="flex flex-wrap items-start justify-between mb-2">
              <h1 className="text-3xl font-bold mb-2">{movie.title}</h1>
              <span className="bg-primary-light text-primary-dark text-sm px-3 py-1 rounded-full">
                {movie.genre || 'Movie'}
              </span>
            </div>

            <div className="flex items-center mb-4 text-gray-700">
              <span>{movie.release_year}</span>
            </div>

            <div className="flex items-center mb-6">
              <div className="flex items-center bg-amber-50 text-amber-700 px-3 py-1 rounded-md">
                <i className="ri-star-fill mr-1"></i>
                <span className="font-medium">{movie.rating || 'No rating'}</span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Overview</h3>
              <p className="text-gray-700 leading-relaxed">
                {movie.description || 'No description available for this movie.'}
              </p>
            </div>

            <MovieWatchlistManager movieId={movie.id} />
          </div>
        </div>
      </main>
    </div>
  );
}
