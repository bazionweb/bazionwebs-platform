import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export type QueryKey = readonly unknown[];

interface CacheEntry {
  data: unknown;
  updatedAt: number;
}

export class QueryClient {
  private cache = new Map<string, CacheEntry>();
  private listeners = new Set<(keyPrefix?: QueryKey) => void>();
  private channel: BroadcastChannel | null = null;
  public defaultOptions: Record<string, unknown>;

  constructor(config?: { defaultOptions?: Record<string, unknown> }) {
    this.defaultOptions = config?.defaultOptions ?? {};
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel("bazion-education-query-sync");
        this.channel.onmessage = (event: MessageEvent<{ type?: string; queryKey?: QueryKey }>) => {
          if (event.data?.type === "INVALIDATE") {
            void this.invalidateLocal(event.data.queryKey);
          }
        };
      } catch {
        this.channel = null;
      }
    }
  }

  private serialize(key: QueryKey): string {
    return JSON.stringify(key);
  }

  getQueryData<T = unknown>(key: QueryKey): T | undefined {
    return this.cache.get(this.serialize(key))?.data as T | undefined;
  }

  setQueryData<T = unknown>(key: QueryKey, updater: T | ((old: T | undefined) => T)): T {
    const prev = this.getQueryData<T>(key);
    const next = typeof updater === "function" ? (updater as (old: T | undefined) => T)(prev) : updater;
    this.cache.set(this.serialize(key), { data: next, updatedAt: Date.now() });
    this.listeners.forEach((l) => l(key));
    return next;
  }

  setQueriesData<T = unknown>(filters: { queryKey?: QueryKey }, updater: T | ((old: T | undefined) => T)) {
    if (!filters?.queryKey) return;
    this.setQueryData(filters.queryKey, updater);
  }

  private async invalidateLocal(queryKey?: QueryKey) {
    if (!queryKey) {
      this.cache.clear();
      this.listeners.forEach((l) => l(undefined));
      return;
    }
    const prefix = JSON.stringify(queryKey).slice(0, -1);
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
      }
    }
    this.listeners.forEach((l) => l(queryKey));
  }

  async invalidateQueries(filters?: { queryKey?: QueryKey }) {
    await this.invalidateLocal(filters?.queryKey);
    try {
      this.channel?.postMessage({ type: "INVALIDATE", queryKey: filters?.queryKey });
    } catch {
      // Ignore broadcast errors in restricted contexts
    }
  }

  async refetchQueries(filters?: { queryKey?: QueryKey }) {
    await this.invalidateQueries(filters);
  }

  subscribe(listener: (keyPrefix?: QueryKey) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const defaultQueryClient = new QueryClient();
const QueryClientContext = createContext<QueryClient>(defaultQueryClient);

export function QueryClientProvider({
  client,
  children,
}: {
  client: QueryClient;
  children?: React.ReactNode;
}) {
  return <QueryClientContext.Provider value={client}>{children}</QueryClientContext.Provider>;
}

export function useQueryClient(): QueryClient {
  return useContext(QueryClientContext);
}

export function useQuery<TData = unknown, TError = Error>(options: {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  retry?: number | boolean;
  initialData?: TData;
}) {
  const client = useQueryClient();
  const { queryKey, queryFn, enabled = true, refetchInterval, initialData } = options;
  const serializedKey = JSON.stringify(queryKey);
  const fnRef = useRef(queryFn);
  fnRef.current = queryFn;

  const cached = client.getQueryData<TData>(queryKey);
  const [data, setData] = useState<TData | undefined>(cached ?? initialData);
  const [error, setError] = useState<TError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled && cached === undefined);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const runFetch = useCallback(async () => {
    if (!enabled) return undefined;
    setIsFetching(true);
    try {
      const result = await fnRef.current();
      client.setQueryData(queryKey, result);
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err as TError);
      return undefined;
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [enabled, serializedKey, client]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void runFetch();
  }, [enabled, runFetch]);

  useEffect(() => {
    return client.subscribe((invalidatedKey) => {
      if (!invalidatedKey || serializedKey.startsWith(JSON.stringify(invalidatedKey).slice(0, -1))) {
        const fresh = client.getQueryData<TData>(queryKey);
        if (fresh !== undefined) setData(fresh);
        else if (enabled) void runFetch();
      }
    });
  }, [client, serializedKey, enabled, runFetch]);

  useEffect(() => {
    if (!enabled || !refetchInterval || typeof refetchInterval !== "number") return;
    const id = setInterval(() => void runFetch(), refetchInterval);
    return () => clearInterval(id);
  }, [enabled, refetchInterval, runFetch]);

  return {
    data,
    error,
    isLoading,
    isFetching,
    isError: error !== null,
    isSuccess: error === null && data !== undefined,
    refetch: runFetch,
  };
}

export function useMutation<TData = unknown, TError = Error, TVariables = void>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
  onSettled?: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<TError | null>(null);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsPending(true);
      setError(null);
      try {
        const res = await options.mutationFn(variables);
        setData(res);
        await options.onSuccess?.(res, variables);
        options.onSettled?.();
        return res;
      } catch (err) {
        const typedErr = err as TError;
        setError(typedErr);
        await options.onError?.(typedErr, variables);
        options.onSettled?.();
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [options]
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      void mutateAsync(variables).catch(() => {});
    },
    [mutateAsync]
  );

  return {
    mutate,
    mutateAsync,
    isPending,
    isLoading: isPending,
    data,
    error,
    reset: () => {
      setData(undefined);
      setError(null);
    },
  };
}

