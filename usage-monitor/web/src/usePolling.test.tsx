import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POLL_MS, usePolling } from './usePolling';

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets pending promise callbacks run, then moves the clock. */
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  visibility = 'visible';
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePolling', () => {
  it('is loading until the first answer, then holds the data', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });
    const { result } = renderHook(() => usePolling('k', fetcher));
    expect(result.current).toMatchObject({ loading: true, data: undefined, error: undefined });

    await tick(0);
    expect(result.current).toMatchObject({ loading: false, data: { n: 1 }, error: undefined });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refreshes every interval', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 }).mockResolvedValue({ n: 3 });
    const { result } = renderHook(() => usePolling('k', fetcher));
    await tick(0);
    expect(POLL_MS).toBe(5000);

    await tick(POLL_MS - 1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual({ n: 2 });

    await tick(POLL_MS);
    expect(result.current.data).toEqual({ n: 3 });
  });

  it('does not flicker: a refresh in flight keeps the data and never reports loading', async () => {
    const second = deferred<{ n: number }>();
    const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => usePolling('k', fetcher));
    await tick(0);

    await tick(POLL_MS);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ loading: false, data: { n: 1 } });

    await act(async () => second.resolve({ n: 2 }));
    expect(result.current).toMatchObject({ loading: false, data: { n: 2 } });
  });

  it('keeps the same data object when a refresh brings the same payload', async () => {
    const fetcher = vi.fn().mockImplementation(async () => ({ rows: [1, 2, 3] }));
    const { result } = renderHook(() => usePolling('k', fetcher));
    await tick(0);
    const first = result.current.data;
    await tick(POLL_MS);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe(first);
  });

  it('does not start a second request while one is still in flight', async () => {
    const slow = deferred<string>();
    const fetcher = vi.fn().mockReturnValue(slow.promise);
    renderHook(() => usePolling('k', fetcher));
    await tick(POLL_MS * 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reports a first-load failure as an error (not loading) and recovers on its own', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ n: 1 });
    const { result } = renderHook(() => usePolling('k', fetcher));
    await tick(0);
    expect(result.current).toMatchObject({ loading: false, data: undefined });
    expect(result.current.error).toEqual(new Error('down'));

    await tick(POLL_MS);
    expect(result.current).toMatchObject({ loading: false, data: { n: 1 }, error: undefined });
  });

  it('keeps the last data while a later poll fails, then clears the error when the API is back', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValue({ n: 2 });
    const { result } = renderHook(() => usePolling('k', fetcher));
    await tick(0);

    await tick(POLL_MS);
    expect(result.current).toMatchObject({ loading: false, data: { n: 1 } });
    expect(result.current.error).toEqual(new Error('down'));

    await tick(POLL_MS);
    expect(result.current.error).toEqual(new Error('still down'));

    await tick(POLL_MS);
    expect(result.current).toMatchObject({ loading: false, data: { n: 2 }, error: undefined });
  });

  it('retry fetches right away instead of waiting for the next tick', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ n: 1 });
    const { result } = renderHook(() => usePolling('k', fetcher));
    await tick(0);
    expect(result.current.error).toBeDefined();

    await act(async () => result.current.retry());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ data: { n: 1 }, error: undefined });
  });

  it('reports fetching only while a poll is in flight with an error showing', async () => {
    const retryCall = deferred<{ n: number }>();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockResolvedValueOnce({ n: 1 })
      .mockRejectedValueOnce(new Error('down'))
      .mockReturnValueOnce(retryCall.promise);
    const { result } = renderHook(() => usePolling('k', fetcher));
    await tick(0);

    const first = result.current.data;
    await tick(POLL_MS); // a quiet refresh: same data object, fetching never raised
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe(first);
    expect(result.current.fetching).toBe(false);

    await tick(POLL_MS); // fails
    expect(result.current).toMatchObject({ fetching: false });
    expect(result.current.error).toEqual(new Error('down'));

    await act(async () => result.current.retry());
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(result.current.fetching).toBe(true);

    await act(async () => retryCall.resolve({ n: 2 }));
    expect(result.current).toMatchObject({ fetching: false, data: { n: 2 }, error: undefined });
  });

  it('pauses while the tab is hidden and catches up the moment it is visible again', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });
    renderHook(() => usePolling('k', fetcher));
    await tick(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => {
      visibility = 'hidden';
    });
    await tick(POLL_MS * 4);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility('visible'));
    expect(fetcher).toHaveBeenCalledTimes(2);

    await tick(POLL_MS);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('ignores visibilitychange to hidden', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });
    renderHook(() => usePolling('k', fetcher));
    await tick(0);
    await act(async () => setVisibility('hidden'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a new key drops the old data, shows loading, and aborts the old request', async () => {
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn(async (signal: AbortSignal) => {
      signals.push(signal);
      return { key: signals.length };
    });
    const { result, rerender } = renderHook(({ k }) => usePolling(k, fetcher), { initialProps: { k: 'a' } });
    await tick(0);
    expect(result.current.data).toEqual({ key: 1 });

    rerender({ k: 'b' });
    expect(result.current).toMatchObject({ loading: true, data: undefined });
    expect(signals[0]!.aborted).toBe(true);

    await tick(0);
    expect(result.current).toMatchObject({ loading: false, data: { key: 2 } });
  });

  it('ignores an answer that arrives after the key changed', async () => {
    const stale = deferred<string>();
    const fetcher = vi.fn().mockReturnValueOnce(stale.promise).mockResolvedValue('new');
    const { result, rerender } = renderHook(({ k }) => usePolling(k, fetcher), { initialProps: { k: 'a' } });
    rerender({ k: 'b' });
    await tick(0);
    await act(async () => stale.resolve('old'));
    expect(result.current.data).toBe('new');
  });

  it('stops polling and aborts on unmount', async () => {
    let signal!: AbortSignal;
    const fetcher = vi.fn(async (s: AbortSignal) => {
      signal = s;
      return 1;
    });
    const { unmount } = renderHook(() => usePolling('k', fetcher));
    await tick(0);
    unmount();
    expect(signal.aborted).toBe(true);
    await tick(POLL_MS * 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses the latest fetcher without restarting the interval', async () => {
    const first = vi.fn().mockResolvedValue('first');
    const second = vi.fn().mockResolvedValue('second');
    const { result, rerender } = renderHook(({ f }) => usePolling('k', f), { initialProps: { f: first } });
    await tick(0);
    rerender({ f: second });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    await tick(POLL_MS);
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('second');
  });
});
