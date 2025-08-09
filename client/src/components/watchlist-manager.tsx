import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SeasonProgressForm } from './season-progress-form';
import { SeasonProgressView } from './season-progress-view';

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
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to watchlist');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/watchlist/check/${showId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist/myshows'] });
    }
  });
  
  // Remove from watchlist mutation
  const removeFromWatchlist = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/watchlist/${showId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from watchlist');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/watchlist/check/${showId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist/myshows'] });
    }
  });
  
  // Update season progress mutation
  const updateSeasonProgress = useMutation({
    mutationFn: async ({ seasonNumber, data }: { seasonNumber: number, data: Partial<SeasonProgressData> }) => {
      const response = await fetch(`/api/watchlist/${showId}/progress/${seasonNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update season progress');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/watchlist/${showId}/progress`] });
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist/myshows'] });
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
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-4">Season Tracking</h3>
            
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
                {seasons.map(seasonNumber => {
                  const progress = findSeasonProgress(seasonNumber);
                  const isEditing = editModeSeasons.includes(seasonNumber);
                  
                  return (
                    <AccordionItem key={seasonNumber} value={`season-${seasonNumber}`}>
                      <AccordionTrigger>Season {seasonNumber}</AccordionTrigger>
                      <AccordionContent>
                        {isEditing || !progress ? (
                          <SeasonProgressForm
                            seasonNumber={seasonNumber}
                            initialData={progress}
                            onSave={(data) => handleSaveProgress(seasonNumber, data)}
                            onCancel={progress ? () => toggleEditMode(seasonNumber) : undefined}
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
        </div>
      )}
    </div>
  );
}