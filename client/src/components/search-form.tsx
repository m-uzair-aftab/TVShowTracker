import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SearchFormProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      toast({
        title: "Search field is empty",
        description: "Please enter a TV show name to search",
        variant: "destructive",
      });
      return;
    }
    
    onSearch(searchQuery);
  };

  return (
    <form className="mb-8" onSubmit={handleSubmit}>
      <div className="relative">
        <input 
          type="text" 
          className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-shadow bg-white text-text placeholder-gray-400"
          placeholder="Enter a TV show name..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary-dark text-white p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          <i className="ri-search-line text-lg"></i>
        </button>
      </div>
      <div className="text-xs text-gray-700 mt-2 pl-1">
        Try searching for "Breaking Bad", "Stranger Things", etc.
      </div>
    </form>
  );
}
