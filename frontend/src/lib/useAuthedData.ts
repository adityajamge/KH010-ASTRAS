import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ApiError } from "./api";

interface AuthedDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Runs `fetcher(token)` on mount and whenever an item in `deps` changes.
 * Handles the Clerk token fetch + loading/error bookkeeping every dashboard
 * section needs, so sections only describe what to fetch and how to render it.
 */
export function useAuthedData<T>(
  fetcher: (token: string) => Promise<T>,
  deps: unknown[] = [],
) {
  const { getToken } = useAuth();
  const [state, setState] = useState<AuthedDataState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ data: prev.data, loading: true, error: null }));
    try {
      const token = await getToken();
      if (!token) {
        throw new ApiError(401, "Could not verify your session. Please sign in again.");
      }
      const data = await fetcher(token);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error:
          err instanceof ApiError
            ? err.message
            : "Could not load data. Please try again.",
      });
    }
    // `deps` describes exactly what should trigger a refetch for each call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
