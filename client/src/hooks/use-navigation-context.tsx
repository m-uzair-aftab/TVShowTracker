import { useEffect } from 'react';

// This hook helps manage navigation context for the "Back" button
export function useNavigationContext(source: string) {
  useEffect(() => {
    // Store the source tab that the user is navigating from
    localStorage.setItem('lastActiveTab', source);
    
    // Clean up when component unmounts
    return () => {
      // We don't clean up the localStorage here to ensure the context persists
    };
  }, [source]);
}