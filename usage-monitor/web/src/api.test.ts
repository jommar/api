import { describe, expect, it } from 'vitest';
import { ApiError, fetchSession, fetchSessions, fetchSummary } from './api';
import { calledUrls, stubApi } from './test/utils';

describe('api client', () => {
  it('asks for sessions with a limit (default 50)', async () => {
    const fetchMock = stubApi(() => ({ body: [] }));
    await fetchSessions();
    await fetchSessions(10);
    expect(calledUrls(fetchMock)).toEqual(['/api/sessions?limit=50', '/api/sessions?limit=10']);
  });

  it('encodes the session id', async () => {
    const fetchMock = stubApi(() => ({ body: {} }));
    await fetchSession('a/b c');
    expect(calledUrls(fetchMock)).toEqual(['/api/sessions/a%2Fb%20c']);
  });

  it('sends only the summary bounds it has', async () => {
    const fetchMock = stubApi(() => ({ body: { byDay: [], byModel: [] } }));
    await fetchSummary({});
    await fetchSummary({ from: 5 });
    await fetchSummary({ from: 5, to: 9 });
    expect(calledUrls(fetchMock)).toEqual(['/api/summary', '/api/summary?from=5', '/api/summary?from=5&to=9']);
  });

  it('returns the parsed body', async () => {
    stubApi(() => ({ body: [{ session: 'x' }] }));
    await expect(fetchSessions()).resolves.toEqual([{ session: 'x' }]);
  });

  it('turns an HTTP error into an ApiError carrying the status', async () => {
    stubApi(() => ({ status: 404, body: { error: 'unknown session' } }));
    const error = await fetchSession('nope').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it('turns an unreachable API into an ApiError without a status', async () => {
    stubApi(() => 'network-error');
    const error = await fetchSessions().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBeUndefined();
  });

  it('lets an abort through as the original error', async () => {
    const controller = new AbortController();
    stubApi(() => {
      controller.abort();
      return 'network-error';
    });
    const error = await fetchSessions(50, controller.signal).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});
