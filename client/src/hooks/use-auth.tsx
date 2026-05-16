import React, { createContext, ReactNode, useContext } from 'react';
import { useQuery, useMutation, UseMutationResult } from '@tanstack/react-query';

import { API_BASE_URL } from '@/config';               // base URL for your Render API
import { apiRequest, queryClient } from '../lib/queryClient';
import { useToast } from '@/hooks/use-toast';          // if your alias isn't set, change to '../hooks/use-toast'
import { useLocation } from 'wouter';
import { setToken, clearToken, getToken } from '../lib/token';


// ---- Types ----
export interface User {
  id: number;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  isObservabilityAdmin?: boolean;
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
  const [, setLocation] = useLocation();

  // Current user: inline queryFn so 401 => undefined (not an error)
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | undefined, Error>({
    queryKey: ['/api/auth/me'],
    enabled: !!getToken(), // Only run if we have a token
    queryFn: async () => {
      const token = getToken();
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await apiRequest('GET', '/api/auth/me');
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
      const data = await res.json();
      
      // Handle new response format with token
      if (data.token && data.user) {
        setToken(data.token);
        return data.user as User;
      }
      
      // Fallback to old format for backward compatibility
      return data as User;
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
      const data = await res.json();
      
      // Handle new response format with token
      if (data.token && data.user) {
        setToken(data.token);
        return data.user as User;
      }
      
      // Fallback to old format for backward compatibility
      return data as User;
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
    // Clear JWT token
    clearToken();
    
    // Immediately clear any notion of a logged-in user
    queryClient.removeQueries({ queryKey: ['/api/auth/me'], exact: true });
    // (Optional) also clear everything else cached
    // queryClient.clear();

    // Redirect to your login page (change to '/' if your login lives there)
    setLocation('/auth');

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
