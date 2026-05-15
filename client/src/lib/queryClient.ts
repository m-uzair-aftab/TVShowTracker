import { QueryClient, QueryFunction, QueryFunctionContext } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config'; // or '../config' if you don't use @ alias
import { getToken } from './token';

type ApiErrorPayload = {
  message?: unknown;
  code?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;

  constructor(status: number, message: string, body: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function parseErrorBody(res: Response) {
  const text = await res.text();
  if (!text) {
    return {
      body: null,
      message: res.statusText,
      code: undefined,
    };
  }

  try {
    const body = JSON.parse(text) as ApiErrorPayload;
    return {
      body,
      message: typeof body.message === 'string' ? body.message : text,
      code: typeof body.code === 'string' ? body.code : undefined,
    };
  } catch {
    return {
      body: text,
      message: text,
      code: undefined,
    };
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const parsed = await parseErrorBody(res);
    throw new ApiError(res.status, parsed.message || res.statusText, parsed.body, parsed.code);
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
      const parsed = await parseErrorBody(res);
      throw new ApiError(res.status, parsed.message || res.statusText, parsed.body, parsed.code);
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
