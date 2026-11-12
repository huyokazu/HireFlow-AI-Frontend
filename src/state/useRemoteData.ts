import { useCallback, useEffect, useRef, useState } from 'react';

export type RemoteData<T> = {
  /** The last loaded value; kept while a reload runs, so lists don't flash empty. */
  data: T | null;
  /** The last load failed. */
  failed: boolean;
  loading: boolean;
  /** Loads again; resolves when done, and never rejects. */
  reload: () => Promise<void>;
  /** Replaces the value locally, e.g. with an item a mutation returned. */
  setData: (update: (current: T | null) => T | null) => void;
};

/** Loads something from the API on mount, with a retry and no stale answers from older requests. */
export function useRemoteData<T>(load: () => Promise<T>): RemoteData<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  // Each load gets a number; only the newest one's answer is kept.
  const latest = useRef(0);

  const settle = useCallback((request: number, outcome: { data: T } | { error: unknown }) => {
    if (request !== latest.current) return;
    if ('data' in outcome) {
      setDataState(outcome.data);
      setFailed(false);
    } else {
      console.warn('[api] Load failed.', outcome.error instanceof Error ? outcome.error.message : outcome.error);
      setFailed(true);
    }
    setLoading(false);
  }, []);

  const start = useCallback(() => {
    const request = ++latest.current;
    return load().then(
      (result) => settle(request, { data: result }),
      (error: unknown) => settle(request, { error }),
    );
  }, [load, settle]);

  const reload = useCallback(() => {
    setLoading(true);
    return start();
  }, [start]);

  useEffect(() => {
    void start();
    // Answers that arrive after unmounting are dropped.
    return () => {
      latest.current += 1;
    };
  }, [start]);

  const setData = useCallback((update: (current: T | null) => T | null) => setDataState(update), []);

  return { data, failed, loading, reload, setData };
}
