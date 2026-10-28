import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { hrefs, navigate, parseRoute, useRoute } from './route';

describe('parseRoute', () => {
  it.each([
    ['', { name: 'sessions' }],
    ['#', { name: 'sessions' }],
    ['#/', { name: 'sessions' }],
    ['#/nope', { name: 'sessions' }],
    ['#/summary', { name: 'summary' }],
    ['#/summary/', { name: 'summary' }],
    ['#/sessions/abc-123', { name: 'session', id: 'abc-123' }],
    ['#/sessions/abc-123/', { name: 'session', id: 'abc-123' }],
    ['#/sessions/a%2Fb%20c', { name: 'session', id: 'a/b c' }],
    ['#/sessions/', { name: 'sessions' }],
    ['#/sessions', { name: 'sessions' }],
    ['#/sessions/a/b', { name: 'sessions' }],
    ['#/sessions/%E0%A4%A', { name: 'sessions' }],
  ])('%s', (hash, expected) => {
    expect(parseRoute(hash)).toEqual(expected);
  });
});

describe('hrefs', () => {
  it('builds hashes that parse back to the same route', () => {
    expect(parseRoute(hrefs.sessions)).toEqual({ name: 'sessions' });
    expect(parseRoute(hrefs.summary)).toEqual({ name: 'summary' });
    expect(parseRoute(hrefs.session('a/b c?#'))).toEqual({ name: 'session', id: 'a/b c?#' });
  });
});

describe('useRoute', () => {
  // jsdom delivers hashchange as a queued task, like a browser, so each step waits for it.
  it('follows hash changes', async () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ name: 'sessions' });

    act(() => navigate(hrefs.summary));
    await waitFor(() => expect(result.current).toEqual({ name: 'summary' }));

    act(() => navigate(hrefs.session('s1')));
    await waitFor(() => expect(result.current).toEqual({ name: 'session', id: 's1' }));

    act(() => {
      window.location.hash = '#/';
    });
    await waitFor(() => expect(result.current).toEqual({ name: 'sessions' }));
  });
});
