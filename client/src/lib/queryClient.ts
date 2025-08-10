import { QueryClient, QueryFunction, QueryFunctionContext } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config'; // or '../config' if you don't use @ alias
import { getToken } from './token';


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
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include', // Keep for backward compatibility
    headers,
    body: data == null ? undefined : JSON.stringify(data),
  });
  await throwIfResNotOk(res);
  return res;
}


type UnauthorizedBehavior = "returnNull" | "throw";


// queryClient.ts
export function getQueryFn(opts?: { on401?: 'returnNull' | 'throw' }): QueryFunction {
  return async ({ queryKey }: QueryFunctionContext) => {
    const [path, params] = queryKey as [string, any?];

    let qs = '';
    if (typeof params === 'string') {
      qs = `?query=${encodeURIComponent(params)}`;
    } else if (params) {
      qs = `?${new URLSearchParams(params as Record<string, string>).toString()}`;
    }

    const token = getToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}${path}${qs}`, {
      credentials: 'include', // Keep for backward compatibility
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    if (!res.ok) {
      if (res.status === 401 && opts?.on401 === 'returnNull') {
        return undefined;
      }
      throw new Error((await res.text()) || res.statusText);
    }

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
