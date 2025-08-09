export function Footer() {
  return (
    <footer className="bg-muted py-6 border-t">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TV Show Tracker. All rights reserved. Built by Uzair Aftab.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            TV data provided by TVmaze API
          </p>
        </div>
      </div>
    </footer>
  );
}