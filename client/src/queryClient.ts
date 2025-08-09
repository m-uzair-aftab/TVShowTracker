import { QueryClient, QueryFunction, QueryFunctionContext } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config';

// ...

export function getQueryFn<T = unknown>(
  opts?: { on401?: 'returnNull' | 'throw' }
): QueryFunction<T> {
  return async ({ queryKey }: QueryFunctionContext) => {
    const [path, params] = queryKey as [string, any?];

    let qs = '';
    if (typeof params === 'string') {
      qs = `?query=${encodeURIComponent(params)}`;
    } else if (params) {
      qs = `?${new URLSearchParams(params as Record<string, string>).toString()}`;
    }

    const res = await fetch(`${API_BASE_URL}${path}${qs}`, { credentials: 'include' });

    if (!res.ok) {
      if (res.status === 401 && opts?.on401 === 'returnNull') {
        // tell TS this is the same T the caller expects
        return undefined as unknown as T;
      }
      throw new Error((await res.text()) || res.statusText);
    }

    return (await res.json()) as T;
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),   // fine: defaults to unknown, each useQuery can specify T
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: { retry: false },
  },
});
