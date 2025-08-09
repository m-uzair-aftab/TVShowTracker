import React, { createContext, ReactNode, useContext } from 'react';
import { useQuery, useMutation, UseMutationResult } from '@tanstack/react-query';

import { API_BASE_URL } from '@/config';               // base URL for your Render API
import { apiRequest, queryClient } from '../lib/queryClient';
import { useToast } from '@/hooks/use-toast';          // if your alias isn't set, change to '../hooks/use-toast'

// ---- Types ----
export interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = LoginData & {
  firstName?: string;
  lastName?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

// ---- Context ----
export const AuthContext = createContext<AuthContextType | null>(null);

// ---- Provider ----
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Current user: inline queryFn so 401 => undefined (not an error)
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | undefined, Error>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include',
      });
      if (res.status === 401) return undefined;           // unauthenticated
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as User;
    },
    retry: false,
  });

  // Login
  const loginMutation = useMutation<User, Error, LoginData>({
    mutationFn: async (credentials) => {
      const res = await apiRequest('POST', '/api/auth/login', credentials);
      return (await res.json()) as User;
    },
    onSuccess: (loggedInUser) => {
      queryClient.setQueryData<User | undefined>(['/api/auth/me'], loggedInUser);
      window.scrollTo(0, 0);
      toast({
        title: 'Login successful',
        description: `Welcome back${
          loggedInUser.firstName ? `, ${loggedInUser.firstName}` : ''
        }!`,
      });
    },
    onError: (e) => {
      toast({
        title: 'Login failed',
        description: e.message || 'Invalid email or password',
        variant: 'destructive',
      });
    },
  });

  // Register
  const registerMutation = useMutation<User, Error, RegisterData>({
    mutationFn: async (userData) => {
      const res = await apiRequest('POST', '/api/auth/register', userData);
      return (await res.json()) as User;
    },
    onSuccess: (newUser) => {
      queryClient.setQueryData<User | undefined>(['/api/auth/me'], newUser);
      window.scrollTo(0, 0);
      toast({
        title: 'Registration successful',
        description: `Welcome to TV Tracker${
          newUser.firstName ? `, ${newUser.firstName}` : ''
        }!`,
      });
    },
    onError: (e) => {
      toast({
        title: 'Registration failed',
        description: e.message || 'Could not create account',
        variant: 'destructive',
      });
    },
  });

  // Logout
  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiRequest('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData<User | undefined>(['/api/auth/me'], undefined);
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
    },
    onError: (e) => {
      toast({
        title: 'Logout failed',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null, // expose null to consumers (easier to handle)
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---- Hook ----
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
