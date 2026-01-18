import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';

interface MovieListCheckResponse {
  inList: boolean;
  listItem?: {
    id: number;
    userId: number;
    movieId: number;
    dateAdded: string;
  };
}

interface MovieActivityData {
  id?: number;
  movieListId?: number;
  dateWatched?: string | null;
  rating?: number | null;
  watchedUsing?: string | null;
}

interface MovieWatchlistManagerProps {
  movieId: number;
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
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

export function MovieWatchlistManager({ movieId }: MovieWatchlistManagerProps) {
  const queryClient = useQueryClient();
  const [dateWatched, setDateWatched] = useState('');
  const [rating, setRating] = useState('');
  const [watchedUsing, setWatchedUsing] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const initialized = useRef(false);

  const {
    data: listData,
    isLoading: checkingList,
    error: listError
  } = useQuery<MovieListCheckResponse>({
    queryKey: [`/api/movies/list/check/${movieId}`],
    enabled: !!movieId
  });

  const {
    data: activityData,
    isLoading: loadingActivity,
    error: activityError
  } = useQuery<MovieActivityData | null>({
    queryKey: [`/api/movies/list/${movieId}/activity`],
    enabled: !!listData?.inList
  });

  const addToList = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/movies/list', { movieId });
      if (!response.ok) {
        throw new Error('Failed to add to list');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/movies/list/check/${movieId}`] });
      setIsEditing(true);
      initialized.current = true;
    }
  });

  const removeFromList = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/movies/list/${movieId}`);
      if (!response.ok) {
        throw new Error('Failed to remove from list');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/movies/list/check/${movieId}`] });
      setIsEditing(false);
      initialized.current = false;
    }
  });

  const updateActivity = useMutation({
    mutationFn: async (data: { dateWatched: string | null; rating: number | null; watchedUsing: string | null }) => {
      const response = await apiRequest('POST', `/api/movies/list/${movieId}/activity`, data);
      if (!response.ok) {
        throw new Error('Failed to update movie activity');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/movies/list/${movieId}/activity`] });
      queryClient.invalidateQueries({ queryKey: ['/api/movies/list/mylist'] });
      setIsEditing(false);
      initialized.current = true;
    }
  });

  const isInList = listData?.inList;
  const initialDate = useMemo(() => toDateInputValue(activityData?.dateWatched), [activityData?.dateWatched]);
  const initialRating = useMemo(() => activityData?.rating?.toString() || '', [activityData?.rating]);
  const initialWatchedUsing = useMemo(() => activityData?.watchedUsing || '', [activityData?.watchedUsing]);

  useEffect(() => {
    setDateWatched(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    setWatchedUsing(initialWatchedUsing);
  }, [initialWatchedUsing]);

  useEffect(() => {
    if (!initialized.current) {
      setIsEditing(!activityData);
      initialized.current = true;
    }
  }, [activityData]);

  if (checkingList) {
    return <div className="mt-4">Checking list status...</div>;
  }

  if (listError) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertDescription>
          Could not check list status. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const parsedRating = rating ? Number(rating) : null;

  return (
    <div className="mt-4">
      <Button
        onClick={() => {
          if (isInList) {
            removeFromList.mutate();
          } else {
            addToList.mutate();
          }
        }}
        className={isInList ? "bg-red-600 hover:bg-red-700" : ""}
        disabled={addToList.isPending || removeFromList.isPending}
      >
        {addToList.isPending || removeFromList.isPending ? (
          <span>Processing...</span>
        ) : isInList ? (
          <>
            <i className="ri-delete-bin-line mr-2"></i> Remove from My List
          </>
        ) : (
          <>
            <i className="ri-bookmark-line mr-2"></i> Add to My List
          </>
        )}
      </Button>

      {isInList && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4">Movie Tracking</h3>

          {loadingActivity ? (
            <div>Loading movie activity...</div>
          ) : activityError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Could not load movie activity. Please try again.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 max-w-sm">
              {isEditing ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="movie-date">Date</Label>
                    <input
                      id="movie-date"
                      type="date"
                      value={dateWatched}
                      onChange={(e) => setDateWatched(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="movie-rating">Rating (1-100)</Label>
                    <input
                      id="movie-rating"
                      type="number"
                      min={1}
                      max={100}
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="movie-watched-using">Watched using</Label>
                    <select
                      id="movie-watched-using"
                      value={watchedUsing}
                      onChange={(e) => setWatchedUsing(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select a service</option>
                      <option value="AMC (Theater)">AMC (Theater)</option>
                      <option value="Netflix">Netflix</option>
                      <option value="Prime Video">Prime Video</option>
                      <option value="Max">Max</option>
                      <option value="Peacock">Peacock</option>
                      <option value="Paramount+">Paramount+</option>
                      <option value="Apple TV+">Apple TV+</option>
                      <option value="Disney+">Disney+</option>
                      <option value="Hulu">Hulu</option>
                      <option value="MGM+">MGM+</option>
                      <option value="Starz">Starz</option>
                      <option value="Showtime">Showtime</option>
                      <option value="Crunchyroll">Crunchyroll</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-end mt-2 space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDateWatched(initialDate);
                        setRating(initialRating);
                        setWatchedUsing(initialWatchedUsing);
                        setIsEditing(false);
                      }}
                      disabled={updateActivity.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => updateActivity.mutate({
                        dateWatched: dateWatched || null,
                        rating: parsedRating && !Number.isNaN(parsedRating) ? parsedRating : null,
                        watchedUsing: watchedUsing || null
                      })}
                      disabled={updateActivity.isPending}
                    >
                      {updateActivity.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <div className="grid gap-2">
                      <div>
                        <span className="font-medium text-muted-foreground">Date:</span> {formatDate(activityData?.dateWatched)}
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Rating:</span> {activityData?.rating ? `${activityData.rating}/100` : 'Not rated'}
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Watched using:</span> {activityData?.watchedUsing || 'Not set'}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="h-8 px-2 text-muted-foreground"
                    >
                      <i className="ri-edit-line mr-1"></i> Edit
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
