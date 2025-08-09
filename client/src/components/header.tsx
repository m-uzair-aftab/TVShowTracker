import React from 'react';
import { Link } from "wouter";
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
            <h1 className="text-xl font-semibold">TV Show Tracker</h1>
          </Link>

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
                <DropdownMenuItem onClick={handleLogout}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}
