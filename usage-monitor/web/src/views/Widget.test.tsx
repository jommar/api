import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { T0, sessions } from '../test/fixtures';
import { calledUrls, renderWithTheme, stubApi } from '../test/utils';
import { Widget } from './Widget';

const today = {
  byDay: [
    { day: '2026-10-27', requests: 4, tools: 1, input: 100, output: 900, cacheRead: 0, cacheWrite: 0, costUsd: 0.5 },
    { day: '2026-10-28', requests: 6, tools: 2, input: 1_000, output: 1_000, cacheRead: 0, cacheWrite: 0, costUsd: 1.25 },
  ],
  byModel: [],
};

function api(url: string) {
  if (url.startsWith('/api/summary')) return { body: today };
  if (url.startsWith('/api/sessions')) return { body: sessions };
  return { status: 404 };
}

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.style.background = '';
  document.body.style.background = '';
});

describe('Widget', () => {
  it('totals every day the summary returns since local midnight', async () => {
    vi.useFakeTimers({ now: T0, toFake: ['Date'] });
    const fetchMock = stubApi(api);
    renderWithTheme(<Widget />);

    expect(await screen.findByLabelText('Cost today')).toHaveTextContent('$1.75');
    expect(screen.getByLabelText('Tokens today')).toHaveTextContent('3k');
    expect(screen.getByLabelText('Requests today')).toHaveTextContent('10');

    const midnight = new Date(T0);
    midnight.setHours(0, 0, 0, 0);
    expect(calledUrls(fetchMock)).toContain(`/api/summary?from=${midnight.getTime()}`);
  });

  it('shows the latest session with its top model and cost', async () => {
    stubApi(api);
    renderWithTheme(<Widget />);
    expect(await screen.findByLabelText('Latest session')).toHaveTextContent('claude-opus-5-5');
    expect(screen.getByLabelText('Latest session')).toHaveTextContent('$48.20');
  });

  it('says the API is offline when it cannot be reached', async () => {
    stubApi(() => 'network-error');
    renderWithTheme(<Widget />);
    expect(await screen.findByText('API offline')).toBeInTheDocument();
  });

  it('makes the page background transparent so the desktop window shows only the card', async () => {
    stubApi(api);
    renderWithTheme(<Widget />);
    await waitFor(() => expect(document.documentElement.style.background).toBe('transparent'));
    expect(document.body.style.background).toBe('transparent');
  });

  it('marks the card as the window drag region', async () => {
    stubApi(api);
    renderWithTheme(<Widget />);
    expect(await screen.findByRole('region', { name: 'Usage' })).toHaveAttribute('data-tauri-drag-region');
  });
});
