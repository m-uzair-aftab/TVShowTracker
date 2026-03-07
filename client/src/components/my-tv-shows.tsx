import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface SeasonProgressData {
  id?: number;
  watchlistId?: number;
  seasonNumber: number;
  startDate?: string | null;
  finishDate?: string | null;
  grade?: string | null;
  rating?: number | null;
}

interface WatchlistShow {
  id: number;
  userId: number;
  showId: number;
  dateAdded: string;
  show: {
    id: number;
    title: string;
    year_start: string;
    year_end: string | null;
    seasons: number | null;
    episodes: number | null;
    genre: string | null;
    rating: string | null;
    description: string | null;
    poster_url: string | null;
  };
  lastActivity: string | null;
  seasons: SeasonProgressData[];
}

export function MyTVShows() {
  const [viewMode, setViewMode] = useState<'large' | 'medium' | 'table'>('large');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const { data: shows, isLoading, error } = useQuery<WatchlistShow[]>({
    queryKey: ['/api/watchlist/myshows'],
    refetchOnWindowFocus: true,
    staleTime: 0, // Consider data stale immediately
  });

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
          Failed to load your TV shows. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!shows || shows.length === 0) {
    return (
      <div className="text-center py-10">
        <h3 className="text-xl font-medium mb-2">No TV Shows in Your List</h3>
        <p className="text-gray-600 mb-6">
          You haven't added any TV shows to your watchlist yet.
        </p>
        <p className="text-gray-600">
          Search for shows and click "Add to My List" to start tracking them.
        </p>
      </div>
    );
  }

  // Helper function to format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not set';
    return format(new Date(dateString + 'T00:00:00'), 'MMM d, yyyy');
  };

  // Count watched seasons (any season with start date)
  const countWatchedSeasons = (seasons: SeasonProgressData[]) => {
    return seasons.filter(season => season.startDate).length;
  };
  
  // Calculate average rating across all seasons
  const calculateAverageRating = (seasons: SeasonProgressData[]) => {
    const ratingsWithValues = seasons.filter(season => season.rating != null);
    if (ratingsWithValues.length === 0) return null;
    
    const sum = ratingsWithValues.reduce((total, season) => 
      total + (season.rating || 0), 0);
    return Math.round(sum / ratingsWithValues.length);
  };
  
  // Filter shows by year
  const filterShowsByYear = (shows: WatchlistShow[], year: string) => {
    if (year === 'all') return shows;
    
    return shows.filter(show => {
      // Check if any season has a start or finish date in the selected year
      return show.seasons.some(season => {
        const startDate = season.startDate ? new Date(season.startDate + 'T00:00:00') : null;
        const finishDate = season.finishDate ? new Date(season.finishDate + 'T00:00:00') : null;
        
        const startYear = startDate ? startDate.getFullYear().toString() : null;
        const finishYear = finishDate ? finishDate.getFullYear().toString() : null;
        
        return startYear === year || finishYear === year;
      });
    });
  };
  
  // Apply year filter to shows
  const filteredShows = shows ? filterShowsByYear(shows, yearFilter) : [];

  return (
    <div>
      {/* Filters and View toggle controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div className="flex flex-col w-full sm:w-auto">
          <Label htmlFor="year-filter" className="mb-2">Filter by Year</Label>
          <Select 
            value={yearFilter} 
            onValueChange={setYearFilter}
          >
            <SelectTrigger id="year-filter" className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="border rounded-md flex">
          <Button 
            variant={viewMode === 'large' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('large')}
            className="flex items-center gap-1"
          >
            <LayoutGrid className="h-4 w-4" /> Large
          </Button>
          <Button 
            variant={viewMode === 'medium' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('medium')}
            className="flex items-center gap-1"
          >
            <LayoutGrid className="h-3 w-3" /> Medium
          </Button>
          <Button 
            variant={viewMode === 'table' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('table')}
            className="flex items-center gap-1"
          >
            <List className="h-4 w-4" /> List
          </Button>
        </div>
      </div>
      
      {/* Show count */}
      {filteredShows.length > 0 && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredShows.length} {filteredShows.length === 1 ? 'show' : 'shows'}
          {yearFilter !== 'all' && ` with activity in ${yearFilter}`}
        </div>
      )}
      
      {/* No results after filtering */}
      {filteredShows.length === 0 && yearFilter !== 'all' && (
        <div className="text-center py-8 bg-muted/20 rounded-lg">
          <h3 className="text-lg font-medium mb-2">No Shows Found</h3>
          <p className="text-muted-foreground">
            None of your shows have tracking activity in {yearFilter}.
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setYearFilter('all')}
          >
            Show All Years
          </Button>
        </div>
      )}
      
      {/* Large card view */}
      {filteredShows.length > 0 && viewMode === 'large' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShows.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <Link href={`/show/${item.show.id}?source=myshows`}>
                <div className="h-48 bg-gray-100 overflow-hidden cursor-pointer">
                  {item.show.poster_url ? (
                    <img
                      src={item.show.poster_url}
                      alt={item.show.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://via.placeholder.com/500x300?text=${encodeURIComponent(item.show.title)}`;
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
                <Link href={`/show/${item.show.id}?source=myshows`}>
                  <h3 className="font-semibold text-lg mb-1 cursor-pointer hover:text-primary transition-colors">
                    {item.show.title}
                  </h3>
                </Link>
                
                <div className="flex justify-between items-center mb-3">
                  <div className="text-sm text-gray-600">
                    {item.show.year_start}{item.show.year_end ? `-${item.show.year_end}` : '-Present'}
                  </div>
                  {item.show.genre && (
                    <Badge variant="outline">{item.show.genre}</Badge>
                  )}
                </div>
                
                <div className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Watched:</span> {countWatchedSeasons(item.seasons)}/{item.show.seasons || '?'} seasons
                </div>
                
                {item.lastActivity && (
                  <div className="text-sm text-gray-700 mb-3">
                    <span className="font-medium">Last activity:</span> {formatDate(item.lastActivity)}
                  </div>
                )}
                
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="seasons">
                    <AccordionTrigger className="text-sm py-2">
                      View Season Progress
                    </AccordionTrigger>
                    <AccordionContent>
                      {item.seasons.length > 0 ? (
                        <div className="space-y-3 pt-2">
                          {item.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber).map((season) => (
                            <div key={season.seasonNumber} className="border-b pb-2 last:border-0">
                              <h4 className="font-medium text-sm mb-1">Season {season.seasonNumber}</h4>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                <div className="text-gray-600">Start Date:</div>
                                <div>{season.startDate ? formatDate(season.startDate) : 'Not set'}</div>
                                
                                <div className="text-gray-600">Finish Date:</div>
                                <div>{season.finishDate ? formatDate(season.finishDate) : 'Not set'}</div>
                                
                                <div className="text-gray-600">Grade:</div>
                                <div>{season.grade || 'Not graded'}</div>
                                
                                <div className="text-gray-600">Rating:</div>
                                <div>{season.rating ? `${season.rating}/100` : 'Not rated'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 py-2">
                          No seasons tracked yet. Click on the show to add season progress.
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Medium card view */}
      {filteredShows.length > 0 && viewMode === 'medium' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredShows.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <Link href={`/show/${item.show.id}?source=myshows`}>
                <div className="h-36 bg-gray-100 overflow-hidden cursor-pointer">
                  {item.show.poster_url ? (
                    <img
                      src={item.show.poster_url}
                      alt={item.show.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://via.placeholder.com/300x200?text=${encodeURIComponent(item.show.title)}`;
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
                <Link href={`/show/${item.show.id}?source=myshows`}>
                  <h3 className="font-medium text-sm mb-1 cursor-pointer hover:text-primary transition-colors line-clamp-1">
                    {item.show.title}
                  </h3>
                </Link>
                
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-gray-600">
                    {item.show.year_start}
                  </div>
                  <div className="text-xs text-gray-600">
                    {countWatchedSeasons(item.seasons)}/{item.show.seasons || '?'} seasons
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Table/List view */}
      {filteredShows.length > 0 && viewMode === 'table' && (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-center font-medium hidden md:table-cell">Years</th>
                <th className="px-4 py-3 text-center font-medium">Progress</th>
                <th className="px-4 py-3 text-center font-medium hidden md:table-cell">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filteredShows.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <Link href={`/show/${item.show.id}?source=myshows`} className="hover:text-primary font-medium">
                      {item.show.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                    {item.show.year_start}{item.show.year_end ? `-${item.show.year_end}` : '-Present'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {countWatchedSeasons(item.seasons)}/{item.show.seasons || '?'} seasons
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                    {item.lastActivity ? formatDate(item.lastActivity) : 'No activity'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}