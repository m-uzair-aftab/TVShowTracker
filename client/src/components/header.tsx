import React from 'react';
import { Link, useLocation } from "wouter";
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function Header() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const isMovieMode = location.startsWith('/movies') || location.startsWith('/movie/');
  const isSharedListView = /^\/[^/]+\/shared-list\/?$/.test(location);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user) return '?';
    const first = user.firstName ? user.firstName.charAt(0) : '';
    const last = user.lastName ? user.lastName.charAt(0) : '';
    return (first + last).toUpperCase() || user.email.charAt(0).toUpperCase();
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <i className="ri-tv-line text-primary text-2xl mr-2"></i>
            <h1 className="text-xl font-semibold">TV & Movies Tracker</h1>
          </Link>

          <div className="flex items-center gap-4">
            {user && !isSharedListView && (
              <div className="flex items-center bg-muted rounded-full p-1">
                <Link
                  href="/"
                  className={`px-3 py-1 text-sm rounded-full ${!isMovieMode ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
                >
                  TV
                </Link>
                <Link
                  href="/movies"
                  className={`px-3 py-1 text-sm rounded-full ${isMovieMode ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
                >
                  Movies
                </Link>
              </div>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="flex flex-col px-2 py-1.5">
                    <span className="font-medium">
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.firstName || user.lastName || 'User'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/" className="w-full">
                      Your TV & Movies
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="w-full">
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link href="/auth">Sign In / Sign Up</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
