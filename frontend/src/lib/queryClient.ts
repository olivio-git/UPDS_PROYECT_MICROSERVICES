import { QueryClient } from "@tanstack/react-query";

/**
 * Single QueryClient for the app: owns caching, deduplication, retries and
 * loading/error state for all server data fetched through useQuery.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Most screens show administrative data that does not change second to
      // second; this avoids refetching on every remount within a short window.
      staleTime: 30_000,
      // Several screens fire multiple heavy aggregation queries. Refetching
      // them all on every alt-tab is more surprising than useful.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
