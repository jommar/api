import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { calledUrls, renderWithTheme, stubApi } from '../test/utils';
import { sessions } from '../test/fixtures';
import { Sessions } from './Sessions';

const bodyRows = () => within(screen.getByRole('table', { name: 'Sessions' })).getAllByRole('row').slice(1);

describe('Sessions', () => {
  it('shows skeletons on the first load, then the table', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    expect(screen.getByLabelText('Loading')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await screen.findByRole('table', { name: 'Sessions' });
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });

  it('asks for the 50 newest and keeps the API order (newest first)', async () => {
    const fetchMock = stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');
    expect(calledUrls(fetchMock)[0]).toBe('/api/sessions?limit=50');

    const links = bodyRows().map((row) => within(row).getByRole('link').getAttribute('href'));
    expect(links).toEqual(['#/sessions/sess-newest', '#/sessions/sess-cheap', '#/sessions/sess-unpriced']);
  });

  it('shows last activity, shortened directory, compact tokens and estimated cost', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');

    const [first, second, third] = bodyRows() as [HTMLElement, HTMLElement, HTMLElement];
    expect(first).toHaveTextContent(/Oct 28, 17:44/);
    expect(first).toHaveTextContent('…/api/usage-monitor');
    for (const compact of ['1.8k', '1.3k', '570k', '1.7M', '167M', '5.3M', '$48.20']) {
      expect(first).toHaveTextContent(compact);
    }
    // The exact figure is available on hover.
    expect(within(first).getAllByTitle('1,840').length).toBeGreaterThan(0);

    expect(second).toHaveTextContent('$0.0042');
    expect(second).toHaveTextContent('1M'); // 999,950 cache write rounds up, not "1000k"
    expect(third).toHaveTextContent('(unknown)');
    expect(third).toHaveTextContent('—');
  });

  it('puts a Session column right after Last activity, with the subtitle saying what the order is', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    const table = await screen.findByRole('table', { name: 'Sessions' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .slice(0, 3)
        .map((h) => h.textContent),
    ).toEqual(['Last activity', 'Session', 'Directory']);
    expect(
      screen.getByText(
        'The 50 most recently active sessions, newest activity first. Costs are estimates (est.) from list prices.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the first 8 characters of the session id in monospace, the full id as its name and tooltip', async () => {
    const id = '4c1e9f2a-77b0-4f6e-a1d3-9d0b5e6a7c11';
    stubApi(() => ({ body: [{ ...sessions[0]!, session: id }, ...sessions.slice(1)] }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');

    const [first, second] = bodyRows() as [HTMLElement, HTMLElement];
    const short = within(first).getByLabelText(id);
    expect(short).toHaveTextContent(/^4c1e9f2a$/);
    expect(short).toHaveClass('font-mono');
    expect(within(second).getByLabelText('sess-cheap')).toHaveTextContent(/^sess-che$/);

    fireEvent.mouseOver(short);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(id);
  });

  it('puts the full working directory in a tooltip', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');
    expect(screen.getAllByLabelText('/home/dev/projects/alpha/api/usage-monitor').length).toBeGreaterThan(0);
  });

  it('shows the most-used model, a count of the others, and every model in a tooltip', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: 'Model' })).toBeInTheDocument();

    const [first, second, third] = bodyRows() as [HTMLElement, HTMLElement, HTMLElement];
    const models = within(first).getByLabelText('claude-opus-5-5, claude-haiku-5-5');
    expect(models).toHaveTextContent(/^claude-opus-5-5 \+1$/);
    expect(within(second).getByLabelText('claude-sonnet-5-5')).toHaveTextContent(/^claude-sonnet-5-5$/);
    expect(within(third).getByLabelText('Unknown model')).toHaveTextContent(/^—$/);

    fireEvent.mouseOver(models);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('claude-opus-5-5, claude-haiku-5-5');
  });

  it('labels the cost column as an estimate', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: 'Est. cost' })).toBeInTheDocument();
  });

  it('opens a session when its row is clicked', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');
    fireEvent.click(bodyRows()[1]!);
    expect(window.location.hash).toBe('#/sessions/sess-cheap');
  });

  describe('row click', () => {
    const open = async () => {
      stubApi(() => ({ body: sessions }));
      renderWithTheme(<Sessions />);
      await screen.findByRole('table');
      return bodyRows()[0]!;
    };

    it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }])(
      'does not navigate on a modified click %o (the browser handles it)',
      async (modifier) => {
        const row = await open();
        fireEvent.click(row, modifier);
        expect(window.location.hash).toBe('');
      },
    );

    it('leaves a click on the inner link to the link', async () => {
      const row = await open();
      const link = within(row).getByRole('link');
      link.addEventListener('click', (e) => e.preventDefault()); // as a link that opens elsewhere would
      fireEvent.click(link);
      expect(window.location.hash).toBe('');

      fireEvent.click(within(row).getByLabelText('sess-newest')); // anywhere else in the row opens the session
      expect(window.location.hash).toBe('#/sessions/sess-newest');
    });

    it('does not navigate while text is selected, e.g. after dragging over the row', async () => {
      const row = await open();
      const selection = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'sess-new' } as Selection);
      fireEvent.click(row);
      expect(window.location.hash).toBe('');

      selection.mockReturnValue({ toString: () => '' } as Selection);
      fireEvent.click(row);
      expect(window.location.hash).toBe('#/sessions/sess-newest');
      selection.mockRestore();
    });
  });

  it('can be used from the keyboard: each row has a focusable link to its session', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');
    const link = within(bodyRows()[0]!).getByRole('link');
    link.focus();
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute('href', '#/sessions/sess-newest');
  });

  it('shows the empty state when nothing has been recorded', async () => {
    stubApi(() => ({ body: [] }));
    renderWithTheme(<Sessions />);
    const empty = await screen.findByRole('status');
    expect(empty).toHaveTextContent(
      'No usage recorded yet. Set apiSocket in the usage-monitor mod to start reporting.',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error state with a retry that recovers', async () => {
    let up = false;
    stubApi(() => (up ? { body: sessions } : 'network-error'));
    renderWithTheme(<Sessions />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach the usage API");
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    up = true;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('table');
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('disables Retry while a poll is in flight, so a click cannot stack requests', async () => {
    let release!: () => void;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementationOnce(async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return { ok: true, status: 200, json: async () => sessions } as Response;
      });
    vi.stubGlobal('fetch', fetchMock);
    renderWithTheme(<Sessions />);

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => expect(retry).toBeDisabled());
    expect(fetchMock).toHaveBeenCalledTimes(2);

    release();
    await screen.findByRole('table');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument());
  });

  it('treats an HTTP 500 as unreachable too', async () => {
    stubApi(() => ({ status: 500, body: { error: 'boom' } }));
    renderWithTheme(<Sessions />);
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the usage API");
  });
});
