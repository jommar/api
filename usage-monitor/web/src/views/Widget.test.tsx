import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { T0, sessions } from '../test/fixtures';
import { calledUrls, renderWithTheme, stubApi } from '../test/utils';
import { resizeWindow } from '../desktopWindow';
import { COLLAPSED_SIZE, EXPANDED_SIZE, Widget } from './Widget';

vi.mock('../desktopWindow', () => ({ resizeWindow: vi.fn() }));

const today = {
  byDay: [
    { day: '2026-10-27', requests: 4, tools: 1, input: 100, output: 900, cacheRead: 0, cacheWrite: 0, costUsd: 0.5 },
    { day: '2026-10-28', requests: 6, tools: 2, input: 1_000, output: 1_000, cacheRead: 40_000, cacheWrite: 0, costUsd: 1.25 },
  ],
  byModel: [
    { model: 'claude-opus-5-5', requests: 8, input: 1_800, output: 1_700, cacheRead: 40_000, cacheWrite: 2_000, costUsd: 1.5 },
    { model: 'claude-haiku-5-5', requests: 2, input: 200, output: 200, cacheRead: 0, cacheWrite: 0, costUsd: 0.25 },
  ],
};

function api(url: string) {
  if (url.startsWith('/api/summary')) return { body: today };
  if (url.startsWith('/api/sessions')) return { body: sessions };
  return { status: 404 };
}

afterEach(() => {
  vi.mocked(resizeWindow).mockClear();
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

  it('expands on double-click into today by model and the recent sessions, and resizes the window', async () => {
    stubApi(api);
    renderWithTheme(<Widget />);
    const card = await screen.findByRole('region', { name: 'Usage' });
    expect(screen.queryByRole('region', { name: 'Usage details' })).not.toBeInTheDocument();

    fireEvent.doubleClick(card);
    const details = await screen.findByRole('region', { name: 'Usage details' });
    expect(resizeWindow).toHaveBeenLastCalledWith(...EXPANDED_SIZE);

    const byModel = within(details).getByRole('table', { name: 'Today by model' });
    expect(within(byModel).getAllByRole('row')).toHaveLength(3); // header + 2 models
    expect(byModel).toHaveTextContent('claude-haiku-5-5');
    expect(byModel).toHaveTextContent('$0.2500');

    const recent = await within(details).findByRole('list', { name: 'Recent sessions' });
    expect(within(recent).getAllByRole('listitem')).toHaveLength(sessions.length);
    expect(recent).toHaveTextContent('/tmp/scratch');

    expect(within(details).getByLabelText('Cache read today')).toHaveTextContent('40k');
  });

  it('collapses back on a second double-click or the collapse button', async () => {
    stubApi(api);
    renderWithTheme(<Widget />);
    const card = await screen.findByRole('region', { name: 'Usage' });

    fireEvent.doubleClick(card);
    fireEvent.doubleClick(await screen.findByRole('region', { name: 'Usage details' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Usage details' })).not.toBeInTheDocument());
    expect(resizeWindow).toHaveBeenLastCalledWith(...COLLAPSED_SIZE);

    fireEvent.doubleClick(screen.getByRole('region', { name: 'Usage' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse' }));
    expect(screen.queryByRole('region', { name: 'Usage details' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cost today')).toBeInTheDocument();
  });
});
