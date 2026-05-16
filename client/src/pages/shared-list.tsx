import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, Loader2, Sparkles, Tv } from 'lucide-react';
import { getTasteProfileDisplayData, TasteProfileCard, type TasteProfileInsightLike } from '@/components/ai-insights';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PublicShow {
  id: number;
  title: string;
  yearStart: string;
  yearEnd: string | null;
  genre: string | null;
  posterUrl: string | null;
  description: string | null;
  watched: string;
  averageRating: number | null;
  grade: string | null;
}

interface PublicMovie {
  id: number;
  title: string;
  releaseYear: string;
  genre: string | null;
  posterUrl: string | null;
  description: string | null;
  rating: number | null;
}

interface SharedListResponse {
  owner: {
    username: string;
    displayName: string;
  };
  includeAllYears: boolean;
  sharedYears: string[];
  availableYears: string[];
  selectedYear: string | null;
  tvShows: PublicShow[];
  movies: PublicMovie[];
  tasteProfiles?: {
    tv: TasteProfileInsightLike | null;
    movie: TasteProfileInsightLike | null;
  };
}

interface SharedListPageProps {
  username: string;
}

export default function SharedListPage({ username }: SharedListPageProps) {
  const [yearFilter, setYearFilter] = useState('all');
  const { data, isLoading, error } = useQuery<SharedListResponse>({
    queryKey: yearFilter === 'all'
      ? [`/api/shared-list/${username}`]
      : [`/api/shared-list/${username}`, { year: yearFilter }],
    retry: false,
  });

  useEffect(() => {
    if (!data || yearFilter === 'all') return;
    if (!data.includeAllYears || !data.availableYears.includes(yearFilter)) {
      setYearFilter('all');
    }
  }, [data, yearFilter]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <div className="flex items-center gap-2 mb-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading shared list</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Card key={item} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Alert>
          <AlertDescription>This shared list is not available.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const yearLabel = data.includeAllYears
    ? yearFilter === 'all' ? 'All years' : yearFilter
    : data.sharedYears.length > 0
      ? data.sharedYears.join(', ')
      : 'No years selected';
  const showYearFilter = data.includeAllYears && data.availableYears.length > 0;
  const tvTasteProfile = getTasteProfileDisplayData(data.tasteProfiles?.tv, 'tv');
  const movieTasteProfile = getTasteProfileDisplayData(data.tasteProfiles?.movie, 'movie');
  const hasTasteProfiles = Boolean(tvTasteProfile || movieTasteProfile);

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-semibold">{data.owner.displayName}'s shared list</h2>
          <p className="text-sm text-muted-foreground mt-1">{yearLabel}</p>
        </div>

        {showYearFilter && (
          <div className="flex flex-col w-full sm:w-[180px]">
            <Label htmlFor="shared-year-filter" className="mb-2">Filter by Year</Label>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger id="shared-year-filter">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {data.availableYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs defaultValue="tv" className="w-full">
        <TabsList className={`grid w-full mb-8 ${hasTasteProfiles ? 'max-w-xl grid-cols-3' : 'max-w-md grid-cols-2'}`}>
          <TabsTrigger value="tv" className="gap-2">
            <Tv className="h-4 w-4" />
            TV Shows
          </TabsTrigger>
          <TabsTrigger value="movies" className="gap-2">
            <Film className="h-4 w-4" />
            Movies
          </TabsTrigger>
          {hasTasteProfiles && (
            <TabsTrigger value="taste-profiles" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Taste Profiles</span>
              <span className="sm:hidden">Profiles</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tv" className="mt-0">
          {data.tvShows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.tvShows.map((show) => (
                <PublicShowCard key={show.id} show={show} />
              ))}
            </div>
          ) : (
            <EmptyState label="No TV shows are included in this shared list." />
          )}
        </TabsContent>

        <TabsContent value="movies" className="mt-0">
          {data.movies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.movies.map((movie) => (
                <PublicMovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          ) : (
            <EmptyState label="No movies are included in this shared list." />
          )}
        </TabsContent>

        {hasTasteProfiles && (
          <TabsContent value="taste-profiles" className="mt-0">
            <div className="space-y-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                These profiles are AI-generated for {data.owner.displayName} from their shared TV and movie history.
              </p>

              <div className="space-y-4">
                {tvTasteProfile && (
                  <TasteProfileCard
                    mediaType="tv"
                    profile={tvTasteProfile.profile}
                    title="TV Profile"
                    generatedAt={tvTasteProfile.generatedAt}
                    defaultOpen={false}
                  />
                )}

                {movieTasteProfile && (
                  <TasteProfileCard
                    mediaType="movie"
                    profile={movieTasteProfile.profile}
                    title="Movie Profile"
                    generatedAt={movieTasteProfile.generatedAt}
                    defaultOpen={false}
                  />
                )}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PublicShowCard({ show }: { show: PublicShow }) {
  const years = show.yearEnd ? `${show.yearStart}-${show.yearEnd}` : `${show.yearStart}-Present`;

  return (
    <Card className="overflow-hidden">
      <Poster src={show.posterUrl} title={show.title} />
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h3 className="font-semibold text-lg leading-tight">{show.title}</h3>
          {show.genre && <Badge variant="outline">{show.genre}</Badge>}
        </div>
        <p className="text-sm text-gray-600 mb-2">{years}</p>
        <p className="text-sm line-clamp-2 mb-3">{show.description || 'No description available'}</p>
        <div className="grid gap-2 text-sm text-gray-700">
          <div><span className="font-medium">Watched:</span> {show.watched}</div>
          <div><span className="font-medium">Average Rating:</span> {show.averageRating !== null ? `${show.averageRating}/100` : 'Not rated'}</div>
          <div><span className="font-medium">Grade:</span> {show.grade || 'Not graded'}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PublicMovieCard({ movie }: { movie: PublicMovie }) {
  return (
    <Card className="overflow-hidden">
      <Poster src={movie.posterUrl} title={movie.title} />
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h3 className="font-semibold text-lg leading-tight">{movie.title}</h3>
          {movie.genre && <Badge variant="outline">{movie.genre}</Badge>}
        </div>
        <p className="text-sm text-gray-600 mb-2">{movie.releaseYear}</p>
        <p className="text-sm line-clamp-2 mb-3">{movie.description || 'No description available'}</p>
        <div className="text-sm text-gray-700">
          <span className="font-medium">Rating:</span> {movie.rating !== null ? `${movie.rating}/100` : 'Not rated'}
        </div>
      </CardContent>
    </Card>
  );
}

function Poster({ src, title }: { src: string | null; title: string }) {
  return (
    <div className="h-48 bg-gray-100 overflow-hidden">
      {src ? (
        <img
          src={src}
          alt={title}
          className="w-full h-full object-cover"
          onError={(event) => {
            (event.target as HTMLImageElement).src = `https://via.placeholder.com/500x300?text=${encodeURIComponent(title)}`;
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center p-4">
            <div className="text-sm text-gray-500">No image available</div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-10 bg-muted/20 rounded-lg">
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
