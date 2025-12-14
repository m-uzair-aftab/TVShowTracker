import React, { useState, useEffect } from 'react';
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

interface MyTVShowsProps {
  onSwitchToSearch?: () => void;
}

export function MyTVShows({ onSwitchToSearch }: MyTVShowsProps) {
  // Load saved preferences from localStorage
  const getSavedPreference = (key: string, defaultValue: string): string => {
    try {
      const savedPrefs = localStorage.getItem('tvShowsPreferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        return prefs[key] || defaultValue;
      }
    } catch (e) {
      console.error('Error loading saved preferences:', e);
    }
    return defaultValue;
  };
  
  // Save preferences to localStorage
  const saveUserPreferences = (newPrefs: Record<string, string>) => {
    try {
      // Get existing preferences or create new object
      const existingPrefsStr = localStorage.getItem('tvShowsPreferences');
      const existingPrefs = existingPrefsStr ? JSON.parse(existingPrefsStr) : {};
      
      // Merge with new preferences
      const updatedPrefs = { ...existingPrefs, ...newPrefs };
      
      // Save back to localStorage
      localStorage.setItem('tvShowsPreferences', JSON.stringify(updatedPrefs));
    } catch (e) {
      console.error('Error saving preferences:', e);
    }
  };
  
  // Initialize with saved preferences or defaults
  const [viewMode, setViewMode] = useState(getSavedPreference('viewMode', 'large'));
  const [yearFilter, setYearFilter] = useState(getSavedPreference('yearFilter', 'all'));
  const [sortBy, setSortBy] = useState(getSavedPreference('sortBy', 'rating'));
  const [sortDirection, setSortDirection] = useState(getSavedPreference('sortDirection', 'desc'));
  
  // Custom state setters that also save to localStorage
  const updateViewMode = (mode: string) => {
    setViewMode(mode);
    saveUserPreferences({ viewMode: mode });
  };
  
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
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  // Count watched seasons (any season with start date or finish date)
  const countWatchedSeasons = (seasons: SeasonProgressData[]) => {
    return seasons.filter(season => season.startDate || season.finishDate).length;
  };
  
  // Get watched seasons as formatted string (S1, S2, S3), respecting year filter
  const getWatchedSeasonsList = (seasons: SeasonProgressData[], yearFilter: string) => {
    const watchedSeasons = seasons
      .filter(season => {
        // First check if the season has been watched at all
        if (!season.startDate && !season.finishDate) {
          return false;
        }
        
        // If filter is "all", include all watched seasons
        if (yearFilter === 'all') {
          return true;
        }
        
        // Otherwise filter seasons based on the selected year
        const startDate = season.startDate ? new Date(season.startDate) : null;
        const finishDate = season.finishDate ? new Date(season.finishDate) : null;
        
        const startYear = startDate ? startDate.getFullYear().toString() : null;
        const finishYear = finishDate ? finishDate.getFullYear().toString() : null;
        
        return startYear === yearFilter || finishYear === yearFilter;
      })
      .sort((a, b) => a.seasonNumber - b.seasonNumber)
      .map(season => `S${season.seasonNumber}`);
    
    return watchedSeasons.length > 0 ? watchedSeasons.join(', ') : 'None';
  };
  
  // Calculate average rating across all seasons
  const calculateAverageRating = (seasons: SeasonProgressData[]) => {
    const ratingsWithValues = seasons.filter(season => season.rating != null);
    if (ratingsWithValues.length === 0) return null;
    
    const sum = ratingsWithValues.reduce((total, season) => 
      total + (season.rating || 0), 0);
    return Math.round(sum / ratingsWithValues.length);
  };
  
  // Calculate average rating only for seasons matching the year filter
  const calculateFilteredAverageRating = (seasons: SeasonProgressData[], yearFilter: string) => {
    // First filter the seasons based on the year filter
    const filteredSeasons = seasons.filter(season => {
      // When filter is "all", only include seasons with start/finish dates
      if (yearFilter === 'all') {
        return season.startDate !== null || season.finishDate !== null;
      }
      
      // Otherwise filter seasons based on the selected year
      const startDate = season.startDate ? new Date(season.startDate) : null;
      const finishDate = season.finishDate ? new Date(season.finishDate) : null;
      
      const startYear = startDate ? startDate.getFullYear().toString() : null;
      const finishYear = finishDate ? finishDate.getFullYear().toString() : null;
      
      return startYear === yearFilter || finishYear === yearFilter;
    });

    // If no seasons match the filter, return null
    if (filteredSeasons.length === 0) return null;
    
    // Now calculate the average of ratings for the filtered seasons only
    const ratingsWithValues = filteredSeasons.filter(season => season.rating != null);
    if (ratingsWithValues.length === 0) return null;
    
    const sum = ratingsWithValues.reduce((total, season) => 
      total + (season.rating || 0), 0);
    return Math.round(sum / ratingsWithValues.length);
  };
  
  // Helper function to calculate grade based on rating
  function calculateGrade(rating: number | null): string | null {
    if (rating === null || rating === 0) return null;
    
    if (rating > 90) return "A+";
    if (rating >= 85 && rating <= 89) return "A";
    if (rating >= 75 && rating <= 84) return "A-";
    if (rating >= 65 && rating <= 74) return "B+";
    if (rating >= 55 && rating <= 64) return "B";
    if (rating >= 45 && rating <= 54) return "B-";
    if (rating >= 40 && rating <= 44) return "C";
    if (rating >= 30 && rating <= 39) return "C-";
    if (rating >= 10 && rating <= 29) return "D";
    if (rating <= 9) return "E";
    
    return null;
  };
  
  // Function to generate and download CSV file
  const exportToCSV = () => {
    // Define the CSV headers
    const headers = ['Title', 'Seasons Watched', 'Your Avg. Rating', 'Your Grade', 'Last Activity'];
    
    // Generate rows from the filtered shows
    const rows = filteredShows.map(item => [
      item.show.title,
      getWatchedSeasonsList(item.seasons, yearFilter),
      calculateFilteredAverageRating(item.seasons, yearFilter) ? 
        `${calculateFilteredAverageRating(item.seasons, yearFilter)}/100` : 'Not rated',
      calculateGrade(calculateFilteredAverageRating(item.seasons, yearFilter)) || 'Not graded',
      item.lastActivity ? formatDate(item.lastActivity) : 'No activity'
    ]);
    
    // Combine headers and rows, properly escape CSV special characters
    const csvContent = [headers, ...rows]
      .map(row => 
        row.map(cell => {
          // Convert to string and handle null/undefined
          const cellStr = String(cell || '');
          // Escape quotes and wrap fields with commas in quotes
          return cellStr.includes(',') || cellStr.includes('"') ? 
            `"${cellStr.replace(/"/g, '""')}"` : 
            cellStr;
        }).join(',')
      )
      .join('\n');
    
    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `my-tv-shows-${yearFilter !== 'all' ? yearFilter : 'all-years'}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up
  };

  // Filter shows by year
  const filterShowsByYear = (shows: WatchlistShow[], year: string) => {
    if (year === 'all') return shows;
    
    return shows.filter(show => {
      // Check if any season has a start or finish date in the selected year
      return show.seasons.some(season => {
        const startDate = season.startDate ? new Date(season.startDate) : null;
        const finishDate = season.finishDate ? new Date(season.finishDate) : null;
        
        const startYear = startDate ? startDate.getFullYear().toString() : null;
        const finishYear = finishDate ? finishDate.getFullYear().toString() : null;
        
        return startYear === year || finishYear === year;
      });
    });
  };
  
  // Sort shows by selected criteria
  const sortShows = (shows: WatchlistShow[], sortBy: string, direction: string) => {
    return [...shows].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.show.title.localeCompare(b.show.title);
          break;
        case 'rating':
          const ratingA = calculateFilteredAverageRating(a.seasons, yearFilter) || 0;
          const ratingB = calculateFilteredAverageRating(b.seasons, yearFilter) || 0;
          comparison = ratingA - ratingB;
          break;
        case 'activity':
          // Sort by last activity date (most recent first)
          const dateA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const dateB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          comparison = dateB - dateA; // Newer dates should be first by default
          break;
        default:
          comparison = a.show.title.localeCompare(b.show.title);
      }
      
      // Apply sort direction
      return direction === 'asc' ? comparison : -comparison;
    });
  };
  
  // Apply filter and sort to shows
  const filteredShows = shows ? sortShows(filterShowsByYear(shows, yearFilter), sortBy, sortDirection) : [];

  // Debug info
  console.log('Current view mode:', viewMode);
  console.log('Filtered shows count:', filteredShows.length);

  return (
    <div>
      {/* Filters and View toggle controls */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Filter and Sort Options */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-col">
            <Label htmlFor="year-filter" className="mb-2">Filter by Year</Label>
            <Select 
              value={yearFilter} 
              onValueChange={updateYearFilter}
            >
              <SelectTrigger id="year-filter" className="w-full sm:w-[180px]">
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
            <Label htmlFor="sort-by" className="mb-2">Sort by</Label>
            <Select 
              value={sortBy} 
              onValueChange={updateSortBy}
            >
              <SelectTrigger id="sort-by" className="w-full sm:w-[180px]">
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
            <Label htmlFor="sort-direction" className="mb-2">Order</Label>
            <Select 
              value={sortDirection} 
              onValueChange={updateSortDirection}
            >
              <SelectTrigger id="sort-direction" className="w-full sm:w-[180px]">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* View Mode Options - Separate Row */}
        <div className="flex justify-between items-center mt-2">
          <div className="border rounded-md flex">
            <Button 
              variant={viewMode === 'large' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => {
                console.log('Setting view mode to large');
                updateViewMode('large');
              }}
              className="flex items-center gap-1"
            >
              <LayoutGrid className="h-4 w-4" /> Large
            </Button>
            <Button 
              variant={viewMode === 'medium' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => {
                console.log('Setting view mode to medium');
                updateViewMode('medium');
              }}
              className="flex items-center gap-1"
            >
              <LayoutGrid className="h-3 w-3" /> Medium
            </Button>
            <Button 
              variant={viewMode === 'table' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => {
                console.log('Setting view mode to table');
                updateViewMode('table');
              }}
              className="flex items-center gap-1"
            >
              <List className="h-4 w-4" /> List
            </Button>
          </div>
          
          {/* Export to CSV button - only visible in table view */}
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
      {viewMode === 'large' && filteredShows.length > 0 && (
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
                  <span className="font-medium">Watched:</span> {getWatchedSeasonsList(item.seasons, yearFilter)}
                </div>
                
                <div className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Your Average Rating:</span> {calculateFilteredAverageRating(item.seasons, yearFilter) ? `${calculateFilteredAverageRating(item.seasons, yearFilter)}` : 'Not rated'}
                </div>
                
                <div className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Your Grade:</span> {calculateGrade(calculateFilteredAverageRating(item.seasons, yearFilter)) || 'Not graded'}
                </div>
                
                {item.lastActivity && (
                  <div className="text-sm text-gray-700 mb-3">
                    <span className="font-medium">Last Activity By You:</span> {formatDate(item.lastActivity)}
                  </div>
                )}
                
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="seasons">
                    <AccordionTrigger className="text-sm py-2">
                      {yearFilter !== 'all' 
                        ? `Seasons Watched in ${yearFilter} Year`
                        : 'Seasons Watched across All Years'
                      }
                    </AccordionTrigger>
                    <AccordionContent>
                      {item.seasons.length > 0 ? (
                        <div className="space-y-3 pt-2">
                          {item.seasons
                            .filter(season => {
                              // When filter is "all", show only seasons with start/finish dates
                              if (yearFilter === 'all') {
                                return season.startDate !== null || season.finishDate !== null;
                              }
                              
                              // Otherwise filter seasons based on the selected year
                              const startDate = season.startDate ? new Date(season.startDate) : null;
                              const finishDate = season.finishDate ? new Date(season.finishDate) : null;
                              
                              const startYear = startDate ? startDate.getFullYear().toString() : null;
                              const finishYear = finishDate ? finishDate.getFullYear().toString() : null;
                              
                              return startYear === yearFilter || finishYear === yearFilter;
                            })
                            .sort((a, b) => a.seasonNumber - b.seasonNumber)
                            .map((season) => (
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
      {viewMode === 'medium' && filteredShows.length > 0 && (
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
                    {getWatchedSeasonsList(item.seasons, yearFilter)}
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  Your Rating: {calculateFilteredAverageRating(item.seasons, yearFilter) ? `${calculateFilteredAverageRating(item.seasons, yearFilter)}` : 'Not rated'}
                </div>
                <div className="text-xs text-gray-600">
                  Your Grade: {calculateGrade(calculateFilteredAverageRating(item.seasons, yearFilter)) || 'Not graded'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Table/List view */}
      {viewMode === 'table' && filteredShows.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-center font-medium">Seasons Watched</th>
                <th className="px-4 py-3 text-center font-medium">Your Avg. Rating</th>
                <th className="px-4 py-3 text-center font-medium">Your Grade</th>
                <th className="px-4 py-3 text-center font-medium hidden md:table-cell">Last Activity By You</th>
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
                  <td className="px-4 py-3 text-center">
                    {getWatchedSeasonsList(item.seasons, yearFilter)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {calculateFilteredAverageRating(item.seasons, yearFilter) ? `${calculateFilteredAverageRating(item.seasons, yearFilter)}` : 'Not rated'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {calculateGrade(calculateFilteredAverageRating(item.seasons, yearFilter)) || 'Not graded'}
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
      
      {/* Add more shows by searching link - shows for all view modes when there are filtered shows */}
      {filteredShows.length > 0 && (
        <div className="text-center py-8 mt-4 border-t border-gray-100">
          <p className="text-gray-600">
            Want to track more shows? <button 
              onClick={() => {
                // Update URL and switch tab
                window.history.replaceState(null, '', '/search');
                if (onSwitchToSearch) onSwitchToSearch();
                // Scroll to top of page
                window.scrollTo(0, 0);
              }}
              className="text-primary font-medium hover:underline cursor-pointer bg-transparent border-none p-0 inline">
              Add more shows by searching
            </button>
          </p>
        </div>
      )}
    </div>
  );
}