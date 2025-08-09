import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_BASE_URL } from '@/config'; // or '../config' if you don't use @ alias


async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}


export async function apiRequest(
  method: string,
  path: string,
  data?: unknown,
): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: data == null ? undefined : JSON.stringify(data),
  });
  await throwIfResNotOk(res);
  return res;
}


type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn(): import('@tanstack/react-query').QueryFunction {
  // expects queryKey like: ['/api/some/path'] or ['/api/search', { q: 'x' }]
  return async ({ queryKey }) => {
    const [path, params] = queryKey as [string, Record<string, any>?];
    const qs = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    const res = await fetch(`${API_BASE_URL}${path}${qs}`, {
      credentials: 'include',
    });
    await throwIfResNotOk(res);
    return res.json();
  };
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
