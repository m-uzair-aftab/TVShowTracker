import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { SearchForm } from '@/components/search-form';
import { MovieResultsSection } from '@/components/movie-results-section';
import { MyMovies } from '@/components/my-movies';
import { AIInsights } from '@/components/ai-insights';
import { Movie } from '@shared/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MoviesHome() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [activeTab, setActiveTab] = useState('mymovies');
  const [, params] = useRoute('/movies/:tab?');

  useEffect(() => {
    if (activeTab === 'mymovies') {
      queryClient.invalidateQueries({ queryKey: ['/api/movies/list/mylist'] });
    }
  }, [activeTab]);

  useEffect(() => {
    const tabParam = params?.tab;
    if (tabParam === 'search') {
      setActiveTab('search');
    } else if (tabParam === 'ai-insights') {
      setActiveTab('ai-insights');
    } else {
      setActiveTab('mymovies');
    }
  }, [params]);

  const { data: movies, isLoading, error } = useQuery<Movie[]>({
    queryKey: ['/api/movies/search', { query: searchQuery }],
    enabled: searchPerformed && !!searchQuery,
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSearchPerformed(true);
  };

  const errorMessage = error
    ? 'An error occurred while searching for movies. Please try again.'
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-8 max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-6">Track Your Favorite Movies</h2>
        </section>

        <Tabs
          defaultValue="mymovies"
          className="max-w-5xl mx-auto"
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            if (value === 'search') {
              window.history.replaceState(null, '', '/movies/search');
            } else if (value === 'ai-insights') {
              window.history.replaceState(null, '', '/movies/ai-insights');
            } else {
              window.history.replaceState(null, '', '/movies');
            }
          }}
        >
          <TabsList className="grid w-full max-w-xl mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="mymovies">My Movies</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-0">
            <section className="mb-8 max-w-3xl mx-auto">
              <SearchForm
                onSearch={handleSearch}
                isLoading={isLoading}
                placeholder="Enter a movie name..."
                helperText='Try searching for "Inception", "The Dark Knight", etc.'
                emptyDescription="Please enter a movie name to search"
              />
            </section>

            <section className="max-w-5xl mx-auto">
              <MovieResultsSection
                isLoading={isLoading}
                searchPerformed={searchPerformed}
                movies={movies || []}
                searchQuery={searchQuery}
                error={errorMessage}
              />
            </section>
          </TabsContent>

          <TabsContent value="mymovies" className="mt-0">
            <MyMovies onSwitchToSearch={() => setActiveTab('search')} />
          </TabsContent>

          <TabsContent value="ai-insights" className="mt-0">
            <AIInsights mediaType="movie" />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
