import { QueryClient, QueryFunctionContext } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config'; // or '../config' if you don't use @ alias


const defaultQueryFn = async ({ queryKey }: QueryFunctionContext) => {
  // Expect: [path, params?]
  const [path, params] = queryKey as [string, Record<string, any>?];

  // Build querystring if you pass an object as the 2nd item in queryKey
  const qs = params ? `?${new URLSearchParams(params as any).toString()}` : '';

  const res = await fetch(`${API_BASE_URL}${path}${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      // keep your other defaults here if you like
    },
  },
});
