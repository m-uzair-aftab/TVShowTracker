import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SeasonProgressForm } from './season-progress-form';
import { SeasonProgressView } from './season-progress-view';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { API_BASE_URL } from '../config';



// Define the right type for API responses
interface WatchlistCheckResponse {
  inWatchlist: boolean;
  watchlistItem?: {
    id: number;
    userId: number;
    showId: number;
    dateAdded: string;
  };
}

interface SeasonProgressData {
  id?: number;
  watchlistId?: number;
  seasonNumber: number;
  startDate?: string | null;
  finishDate?: string | null;
  grade?: string | null;
  rating?: number | null;
}

interface WatchlistManagerProps {
  showId: number;
  totalSeasons: number | null;
}

export function WatchlistManager({ showId, totalSeasons }: WatchlistManagerProps) {
  const queryClient = useQueryClient();
  const [editModeSeasons, setEditModeSeasons] = useState<number[]>([]);
  const [showWatchedOnly, setShowWatchedOnly] = useState<boolean>(false);
  
  // Check if show is in watchlist
  const { 
    data: watchlistData,
    isLoading: checkingWatchlist,
    error: watchlistError
  } = useQuery<WatchlistCheckResponse>({
    queryKey: [`/api/watchlist/check/${showId}`],
    enabled: !!showId
  });
  
  // Get season progress data if show is in watchlist
  const { 
    data: progressData = [],
    isLoading: loadingProgress,
    error: progressError 
  } = useQuery<SeasonProgressData[]>({
    queryKey: [`/api/watchlist/${showId}/progress`],
    enabled: !!watchlistData?.inWatchlist
  });
  
  // Add to watchlist mutation
  const addToWatchlist = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId }),
        credentials: 'include' // if you need cookies/session
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to watchlist');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/watchlist/check/${showId}`] });
    }
  });
  
  // Remove from watchlist mutation
  const removeFromWatchlist = useMutation({
    mutationFn: async () => {
    const response = await fetch(`${API_BASE_URL}/api/watchlist/${showId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

      
      if (!response.ok) {
        throw new Error('Failed to remove from watchlist');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/watchlist/check/${showId}`] });
    }
  });
  
  // Update season progress mutation
  const updateSeasonProgress = useMutation({
    mutationFn: async ({ seasonNumber, data }: { seasonNumber: number, data: Partial<SeasonProgressData> }) => {
      const response = await fetch(`${API_BASE_URL}/api/watchlist/${showId}/progress/${seasonNumber}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

      
      if (!response.ok) {
        throw new Error('Failed to update season progress');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/watchlist/${showId}/progress`] });
      // Remove season from edit mode
      setEditModeSeasons(prev => prev.filter(s => s !== variables.seasonNumber));
    }
  });
  
  // Generate a list of seasons
  const seasons = Array.from({ length: totalSeasons || 0 }, (_, i) => i + 1);
  
  // Toggle watch list status
  const toggleWatchlist = () => {
    if (watchlistData?.inWatchlist) {
      removeFromWatchlist.mutate();
    } else {
      addToWatchlist.mutate();
    }
  };
  
  // Handle save season progress
  const handleSaveProgress = (seasonNumber: number, progressData: Partial<SeasonProgressData>) => {
    updateSeasonProgress.mutate({ seasonNumber, data: progressData });
  };
  
  // Toggle edit mode for a season
  const toggleEditMode = (seasonNumber: number) => {
    if (editModeSeasons.includes(seasonNumber)) {
      setEditModeSeasons(prev => prev.filter(s => s !== seasonNumber));
    } else {
      setEditModeSeasons(prev => [...prev, seasonNumber]);
    }
  };
  
  // Find progress data for a season
  const findSeasonProgress = (seasonNumber: number) => {
    return progressData.find(p => p.seasonNumber === seasonNumber);
  };
  
  // Check if a season is watched (has start date or finish date)
  const isSeasonWatched = (season: SeasonProgressData | undefined) => {
    return season?.startDate || season?.finishDate;
  };
  
  if (checkingWatchlist) {
    return <div className="mt-4">Checking watchlist status...</div>;
  }
  
  if (watchlistError) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertDescription>
          Could not check watchlist status. Please try again.
        </AlertDescription>
      </Alert>
    );
  }
  
  const isInWatchlist = watchlistData?.inWatchlist;
  
  return (
    <div className="mt-4">
      <Button 
        onClick={toggleWatchlist}
        className={isInWatchlist ? "bg-red-600 hover:bg-red-700" : ""}
        disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
      >
        {addToWatchlist.isPending || removeFromWatchlist.isPending ? (
          <span>Processing...</span>
        ) : isInWatchlist ? (
          <>
            <i className="ri-delete-bin-line mr-2"></i> Remove from My List
          </>
        ) : (
          <>
            <i className="ri-bookmark-line mr-2"></i> Add to My List
          </>
        )}
      </Button>
      
      {isInWatchlist && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Season Tracking</h3>
            <div className="flex items-center space-x-2">
              <Switch 
                id="watched-filter"
                checked={showWatchedOnly}
                onCheckedChange={setShowWatchedOnly}
              />
              <Label htmlFor="watched-filter">Show only watched seasons</Label>
            </div>
          </div>
          
          {loadingProgress ? (
            <div>Loading season progress...</div>
          ) : progressError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Could not load season progress. Please try again.
              </AlertDescription>
            </Alert>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {seasons
                .filter(seasonNumber => {
                  if (!showWatchedOnly) return true;
                  const progress = findSeasonProgress(seasonNumber);
                  return isSeasonWatched(progress);
                })
                .map(seasonNumber => {
                  const progress = findSeasonProgress(seasonNumber);
                  const isEditing = editModeSeasons.includes(seasonNumber);
                  const watched = isSeasonWatched(progress);
                  
                  return (
                    <AccordionItem key={seasonNumber} value={`season-${seasonNumber}`}>
                      <AccordionTrigger>
                        <span className="flex items-center">
                          Season {seasonNumber}
                          {watched && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                              Watched
                            </span>
                          )}
                          {!watched && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                              Not Watched
                            </span>
                          )}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {isEditing || !progress ? (
                          <SeasonProgressForm
                            seasonNumber={seasonNumber}
                            initialData={progress}
                            onSave={(data) => handleSaveProgress(seasonNumber, data)}
                            onCancel={progress ? () => toggleEditMode(seasonNumber) : undefined}
                            isSaving={updateSeasonProgress.isPending}
                          />
                        ) : (
                          <SeasonProgressView
                            seasonNumber={seasonNumber}
                            data={progress}
                            onEdit={() => toggleEditMode(seasonNumber)}
                          />
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
}