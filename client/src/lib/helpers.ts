/**
 * Helper functions for navigation and URL handling
 */

// Create a link with source parameter
export function createLinkWithSource(path: string, source: string): string {
  return `${path}?source=${source}`;
}

// Extract source parameter from search string
export function getSourceFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return params.get('source') || 'search'; // Default to search if not specified
}