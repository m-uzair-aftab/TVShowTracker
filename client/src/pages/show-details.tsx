import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, Link, useLocation } from 'wouter';
import { getSourceFromSearch } from '@/lib/helpers';
import { TvShow } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { WatchlistManager } from '@/components/watchlist-manager-fixed';

export default function ShowDetails() {
  const [match, params] = useRoute('/show/:id');
  const [, navigate] = useLocation();
  const id = params?.id;
  
  // Handle context-aware back navigation
  const handleGoBack = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Get the source from URL query parameters (search or myshows)
    const source = new URLSearchParams(window.location.search).get('source') || 'myshows';
    
    // Navigate back to the appropriate tab
    if (source === 'search') {
      navigate('/search');
    } else {
      navigate('/'); // Root URL now displays My TV Shows tab
    }
  };
  
  const { data: show, isLoading: loading, error } = useQuery<TvShow, Error>({
    queryKey: [`/api/tv-shows/${id}`],
    enabled: !!id,
  });
  
  if (!id) {
    return <div>Invalid show ID</div>;
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-4" asChild>
            <Link href="/" className="inline-flex items-center">
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
  
  if (error || !show) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" className="mb-4" asChild>
            <Link href="/" className="inline-flex items-center">
              <i className="ri-arrow-left-line mr-1"></i> Back
            </Link>
          </Button>
          
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <p className="text-red-700">
                Error loading show details. Please try again later.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  const yearsDisplay = show.year_end 
    ? `${show.year_start}-${show.year_end}` 
    : `${show.year_start}-Present`;
    
  const seasonsDisplay = show.seasons === 1 
    ? '1 Season' 
    : `${show.seasons} Seasons`;

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
                src={show.poster_url || 'https://via.placeholder.com/500x750?text=No+Image+Available'} 
                alt={show.title} 
                className="w-full rounded-md object-cover aspect-[2/3]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/500x750?text=Image+Error';
                }}
              />
            </div>
          </div>
          
          <div className="w-full md:w-2/3">
            <div className="flex flex-wrap items-start justify-between mb-2">
              <h1 className="text-3xl font-bold mb-2">{show.title}</h1>
              <span className="bg-primary-light text-primary-dark text-sm px-3 py-1 rounded-full">
                {show.genre || 'TV Show'}
              </span>
            </div>
            
            <div className="flex items-center mb-4 text-gray-700">
              <span>{yearsDisplay}</span>
              <span className="mx-2">•</span>
              <span>{seasonsDisplay}</span>
              <span className="mx-2">•</span>
              <span>{show.episodes ? `${show.episodes} episodes` : 'Unknown episodes'}</span>
            </div>
            
            <div className="flex items-center mb-6">
              <div className="flex items-center bg-amber-50 text-amber-700 px-3 py-1 rounded-md">
                <i className="ri-star-fill mr-1"></i>
                <span className="font-medium">{show.rating || 'No rating'}</span>
              </div>
            </div>
            
            {/* Show description */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Overview</h3>
              <p className="text-gray-700 leading-relaxed">
                {show.description || 'No description available for this show.'}
              </p>
            </div>
            
            {/* Watchlist management */}
            {show.seasons && <WatchlistManager showId={show.id} totalSeasons={show.seasons} />}
          </div>
        </div>
      </main>
    </div>
  );
}