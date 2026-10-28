import { useCallback, useEffect, useRef, useState } from 'react';

export const POLL_MS = 5000;

interface State<T> {
  key: string;
  data?: T;
  error?: unknown;
}

export interface Polled<T> {
  data: T | undefined;
  error: unknown;
  /** True only until the first answer (data or error) for this key; refreshes never set it. */
  loading: boolean;
  /**
   * True while a poll is in flight and an error is showing, so a Retry button can wait for it.
   * Refreshes that start without an error never set it, so a quiet refresh still does not re-render.
   */
  fetching: boolean;
  /** Fetch now instead of waiting for the next tick; does nothing while a poll is in flight. */
  retry: () => void;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Fetches on mount and every `intervalMs` while the tab is visible, and once more when it becomes
 * visible again. `key` names the request: a new key drops the old data and starts over. A failed
 * poll keeps the last data and sets `error`; the next successful poll clears it.
 */
export function usePolling<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>, intervalMs = POLL_MS): Polled<T> {
  const [state, setState] = useState<State<T>>({ key });
  const [fetching, setFetching] = useState(false);
  const hasError = useRef(false);
  const fetchingRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  const pollNow = useRef<() => void>(() => {});

  useEffect(() => {
    fetcherRef.current = fetcher;
    hasError.current = state.key === key && state.error !== undefined;
  });

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      if (hasError.current) {
        fetchingRef.current = true;
        setFetching(true);
      }
      try {
        const data = await fetcherRef.current(controller.signal);
        if (controller.signal.aborted) return;
        // Identical payloads keep the same state object, so a quiet refresh does not re-render.
        setState((prev) =>
          prev.key === key && prev.error === undefined && sameJson(prev.data, data) ? prev : { key, data },
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((prev) => ({ key, data: prev.key === key ? prev.data : undefined, error }));
      } finally {
        inFlight = false;
        if (fetchingRef.current && !controller.signal.aborted) {
          fetchingRef.current = false;
          setFetching(false);
        }
      }
    };

    const pollIfVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };

    pollNow.current = () => void poll();
    void poll();
    const timer = setInterval(pollIfVisible, intervalMs);
    document.addEventListener('visibilitychange', pollIfVisible);
    return () => {
      controller.abort();
      if (fetchingRef.current) {
        fetchingRef.current = false;
        setFetching(false);
      }
      clearInterval(timer);
      document.removeEventListener('visibilitychange', pollIfVisible);
    };
  }, [key, intervalMs]);

  const retry = useCallback(() => pollNow.current(), []);
  const current: State<T> = state.key === key ? state : { key };
  return {
    data: current.data,
    error: current.error,
    fetching,
    loading: current.data === undefined && current.error === undefined,
    retry,
  };
}
