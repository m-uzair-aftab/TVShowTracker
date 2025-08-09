import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { SearchForm } from '@/components/search-form';
import { ResultsSection } from '@/components/results-section';
import { MyTVShows } from '@/components/fixed-my-tv-shows';
import { TvShow } from '@shared/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE_URL } from '../config';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [activeTab, setActiveTab] = useState('myshows');
  const [, params] = useRoute('/:tab?');
  
  // Add an effect to refresh the My TV Shows data when the tab is changed
  useEffect(() => {
    if (activeTab === 'myshows') {
      // Invalidate the query to force a refresh
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist/myshows'] });
    }
  }, [activeTab]);
  
  // Check for URL tab parameter when landing on this page
  // This enables the "Back" button context awareness
  useEffect(() => {
    const tabParam = params?.tab;
    if (tabParam === 'search') {
      setActiveTab('search');
    } else {
      setActiveTab('myshows');
    }
  }, [params]);
  
  // This effect was duplicated - removed


const { data: shows, isLoading, error } = useQuery<TvShow[]>({
  queryKey: ['/api/tv-shows/search', { query: searchQuery }],
  enabled: searchPerformed && !!searchQuery,
});

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSearchPerformed(true);
  };

  const errorMessage = error 
    ? 'An error occurred while searching for TV shows. Please try again.' 
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-8 max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-6">Track Your Favorite Shows</h2>
        </section>
        
        <Tabs 
          defaultValue="myshows" 
          className="max-w-5xl mx-auto"
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            // Update URL without refreshing the page when tab changes
            if (value === 'search') {
              window.history.replaceState(null, '', '/search');
            } else {
              window.history.replaceState(null, '', '/');
            }
          }}
        >
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="myshows">My TV Shows</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="mt-0">
            <section className="mb-8 max-w-3xl mx-auto">
              <SearchForm onSearch={handleSearch} isLoading={isLoading} />
            </section>
            
            <section className="max-w-5xl mx-auto">
              <ResultsSection 
                isLoading={isLoading} 
                searchPerformed={searchPerformed} 
                shows={shows || []} 
                searchQuery={searchQuery}
                error={errorMessage}
              />
            </section>
          </TabsContent>
          
          <TabsContent value="myshows" className="mt-0">
            {/* Pass the setActiveTab function to MyTVShows component */}
            <MyTVShows onSwitchToSearch={() => setActiveTab('search')} />
          </TabsContent>
        </Tabs>
      </main>
      

    </div>
  );
}
