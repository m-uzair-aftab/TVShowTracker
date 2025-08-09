/**
 * Helper module to manage navigation context between tabs
 */

// Set the source tab when navigating to show details
export function setSourceTab(tabName: string): void {
  localStorage.setItem('sourceTab', tabName);
}

// Get the source tab to return to
export function getSourceTab(): string {
  return localStorage.getItem('sourceTab') || 'search';
}