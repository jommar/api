import type { ReactElement } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { render } from '@testing-library/react';
import { onTestFinished, vi } from 'vitest';
import { theme } from '../theme';

export function renderWithTheme(ui: ReactElement) {
  return render(
    <ThemeProvider theme={theme} defaultMode="dark" noSsr>
      {ui}
    </ThemeProvider>,
  );
}

export interface FakeReply {
  status?: number;
  body?: unknown;
}

/**
 * Replaces `fetch` with a handler that answers by URL. Throwing from the handler (or returning
 * `'network-error'`) makes the request fail the way an unreachable API does.
 */
export function stubApi(handler: (url: string) => FakeReply | 'network-error') {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const reply = handler(String(input));
    if (reply === 'network-error') throw new TypeError('Failed to fetch');
    const status = reply.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** jsdom has no clipboard: gives the test a `writeText` spy, removed again when the test ends. */
export function stubClipboard(writeText: (text: string) => Promise<void> = async () => {}) {
  const spy = vi.fn(writeText);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: spy }, configurable: true });
  onTestFinished(() => void Reflect.deleteProperty(navigator, 'clipboard'));
  return spy;
}

export const calledUrls = (fetchMock: ReturnType<typeof stubApi>) => fetchMock.mock.calls.map(([url]) => String(url));
