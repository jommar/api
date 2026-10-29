import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Session, SessionAgent, ToolCount } from '../api';
import { calledUrls, renderWithTheme, stubApi, stubClipboard } from '../test/utils';
import { sessions } from '../test/fixtures';
import { Sessions } from './Sessions';

const bodyRows = () => within(screen.getByRole('table', { name: 'Sessions' })).getAllByRole('row').slice(1);

/** The fixtures with the first session's tool calls replaced, its total kept their sum. */
const withTools = (toolCounts: ToolCount[]): Session[] => [
  { ...sessions[0]!, toolCounts, tools: toolCounts.reduce((sum, t) => sum + t.count, 0) },
  ...sessions.slice(1),
];
const numberedTools = (length: number): ToolCount[] =>
  Array.from({ length }, (_, i) => ({ tool: `tool-${i + 1}`, count: length - i }));

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
    expect(within(first).getAllByLabelText('1,840').length).toBeGreaterThan(0);

    expect(second).toHaveTextContent('$0.0042');
    expect(second).toHaveTextContent('1M'); // 999,950 cache write rounds up, not "1000k"
    expect(third).toHaveTextContent('(unknown)');
    expect(third).toHaveTextContent('—');
  });

  it('stacks each pair of figures in one cell, the top line first', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    await screen.findByRole('table');
    const first = bodyRows()[0]!;

    const pairs = [
      ['1.8k', '1.3k'], // requests over tools
      ['570k', '1.7M'], // new in over out
      ['167M', '5.3M'], // cache read over cache write
    ] as const;
    for (const [topText, bottomText] of pairs) {
      const top = within(first).getByText(topText);
      const bottom = within(first).getByText(bottomText);
      const cell = top.closest('td')!;
      expect(cell).toContainElement(bottom);
      expect(cell).not.toHaveAttribute('title'); // the tooltips sit on the numbers, not on the cell
      expect(cell.textContent).toBe(topText + bottomText); // top line first
      expect(cell).toHaveClass('MuiTableCell-alignRight');
    }

    // Session over Directory: the id on the first line, the full path on hover of the second.
    const sessionCell = within(first).getByLabelText('sess-newest').closest('td')!;
    const directory = within(sessionCell).getByLabelText('/home/dev/projects/alpha/api/usage-monitor');
    expect(directory).toHaveTextContent('…/api/usage-monitor');
    expect(sessionCell.textContent).toBe('sess-new…/api/usage-monitor');
  });

  describe('number tooltips', () => {
    const open = async (body: Session[] = sessions) => {
      stubApi(() => ({ body }));
      renderWithTheme(<Sessions />);
      await screen.findByRole('table');
      return bodyRows() as [HTMLElement, HTMLElement, HTMLElement];
    };
    const hover = (el: HTMLElement) => {
      fireEvent.mouseOver(el);
      return screen.findByRole('tooltip');
    };
    /** Each row as [name, count]; the "+N more" row has no such parts. */
    const toolRows = (tooltip: HTMLElement) =>
      within(tooltip)
        .queryAllByRole('listitem')
        .map((li) => Array.from(li.children, (part) => part.textContent));

    it('puts requests, tools, new in, out, cache read and cache write on an MUI tooltip with the exact value', async () => {
      const [first] = await open();
      const numbers = [
        ['1.8k', '1,840'], // requests
        ['1.3k', '1,288'], // tools
        ['570k', '570,400'], // new in
        ['1.7M', '1,665,200'], // out
        ['167M', '167,440,000'], // cache read
        ['5.3M', '5,336,000'], // cache write
      ] as const;

      expect(first.querySelectorAll('[title]')).toHaveLength(0);
      for (const [text, exact] of numbers) {
        const number = within(first).getByText(text);
        expect(number).not.toHaveAttribute('title');
        expect(await hover(number)).toHaveTextContent(exact);
        fireEvent.mouseLeave(number);
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
      }
    });

    it('lists the tools used, with the exact total first and each count, in the order the API gave', async () => {
      const [first] = await open();
      const tooltip = await hover(within(first).getByText('1.3k'));

      expect(tooltip).toHaveTextContent(/^1,288 tool calls/);
      expect(toolRows(tooltip)).toEqual([
        ['Bash', '600'],
        ['Read', '400'],
        ['Edit', '200'], // not sorted by name
        ['mcp__playwright__browser_evaluate', '88'],
      ]);
      const [name, count] = within(tooltip).getAllByRole('listitem')[3]!.children;
      expect(name).toHaveClass('font-mono', 'break-all'); // a long name wraps instead of widening the tooltip
      expect(count).toHaveClass('tabular-nums', 'shrink-0');
    });

    it('shows the top 8 tools and a "+N more" row for the rest', async () => {
      const tools = numberedTools(11);
      const [first] = await open(withTools(tools));
      const tooltip = await hover(within(first).getByText('66'));

      expect(tooltip).toHaveTextContent(/^66 tool calls/);
      expect(toolRows(tooltip).slice(0, 8)).toEqual(tools.slice(0, 8).map(({ tool, count }) => [tool, String(count)]));
      expect(within(tooltip).getAllByRole('listitem')).toHaveLength(9);
      expect(within(tooltip).getAllByRole('listitem')[8]).toHaveTextContent(/^\+3 more$/);
      expect(tooltip).not.toHaveTextContent('tool-9');
    });

    it('has no "more" row when there are exactly 8 tools', async () => {
      const [first] = await open(withTools(numberedTools(8)));
      const tooltip = await hover(within(first).getByText('36'));

      expect(within(tooltip).getAllByRole('listitem')).toHaveLength(8);
      expect(tooltip).not.toHaveTextContent('more');
    });

    it('shows only the total when the session made no tool calls', async () => {
      const [, , third] = await open();
      const tooltip = await hover(within((third as HTMLTableRowElement).cells[3]!).getByText('0'));

      expect(tooltip).toHaveTextContent(/^0 tool calls$/);
      expect(within(tooltip).queryAllByRole('listitem')).toHaveLength(0);
    });

    it('says "1 tool call" for a single call', async () => {
      const [first] = await open(withTools([{ tool: 'Read', count: 1 }]));
      const tooltip = await hover(within(first).getByText('1'));

      expect(tooltip).toHaveTextContent(/^1 tool callRead1$/);
    });
  });

  it('has seven columns, stacked headers named as their cells are, and a subtitle saying the order', async () => {
    stubApi(() => ({ body: sessions }));
    renderWithTheme(<Sessions />);
    const table = await screen.findByRole('table', { name: 'Sessions' });
    const names = [
      'Last activity',
      'Session Directory',
      'Model',
      'Requests Tools',
      'New in Out',
      'Cache read Cache write',
      'Est. cost',
    ];
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(names.length);
    names.forEach((name, i) => expect(headers[i]).toHaveAccessibleName(name));
    expect(within(bodyRows()[0]!).getAllByRole('cell')).toHaveLength(names.length);
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

  describe('Model cell', () => {
    const main = (model: string, costUsd: number | null = 1): SessionAgent => ({ agent: 'main', label: '', model, costUsd });
    const sub = (id: string, costUsd: number | null, over: Partial<SessionAgent> = {}): SessionAgent => ({
      agent: id,
      label: `label ${id}`,
      model: 'claude-haiku-5-5',
      costUsd,
      ...over,
    });
    /** The fixtures with the first session's agents, models and total cost replaced. */
    const withAgents = (agents: SessionAgent[], over: Partial<Session> = {}): Session[] => [
      { ...sessions[0]!, agents, ...over },
      ...sessions.slice(1),
    ];
    const open = async (body: Session[] = sessions) => {
      stubApi(() => ({ body }));
      renderWithTheme(<Sessions />);
      await screen.findByRole('table');
      return bodyRows() as HTMLTableRowElement[];
    };
    /** What the row shows, and the element the tooltip hangs on. */
    const modelOf = (row: HTMLTableRowElement) => row.cells[2]!.firstElementChild as HTMLElement;
    const hover = (el: HTMLElement) => {
      fireEvent.mouseOver(el);
      return screen.findByRole('tooltip');
    };
    /** Each agent row as [name, model, cost]; the "+N more" row as [text, cost]. */
    const agentRows = (tooltip: HTMLElement) =>
      within(tooltip)
        .getAllByRole('listitem')
        .map((li) => {
          const [left, cost] = Array.from(li.children) as [HTMLElement, HTMLElement];
          const parts = left.children.length > 0 ? Array.from(left.children, (part) => part.textContent) : [left.textContent];
          return [...parts, cost.textContent];
        });
    const totalRow = (tooltip: HTMLElement) => within(tooltip).getByText('Total').parentElement!;

    it('shows the main agent model and a count of the other models, and has a Model column', async () => {
      const [first, second, third] = await open();
      expect(screen.getByRole('columnheader', { name: 'Model' })).toBeInTheDocument();

      expect(modelOf(first!).textContent).toBe('claude-opus-5-5 +1');
      expect(modelOf(first!)).toHaveClass('font-mono', 'truncate');
      expect(modelOf(second!).textContent).toBe('claude-sonnet-5-5');
      expect(modelOf(third!).textContent).toBe('—');
    });

    it('shows the main agent model even when a subagent made more requests or used another model', async () => {
      // Most-used first, as the API orders `models`: the subagent's model leads, the main agent's is second.
      const body = withAgents([main('claude-sonnet-5-5'), sub('agent-busy', 9)], {
        models: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
      });
      const [first] = await open(body);

      expect(modelOf(first!).textContent).toBe('claude-sonnet-5-5 +1');
    });

    it('counts only the models other than the one shown after the "+"', async () => {
      const [first] = await open(
        withAgents([main('claude-opus-5-5'), sub('a', 1), sub('b', 1, { model: 'claude-sonnet-5-5' })], {
          models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
        }),
      );

      expect(modelOf(first!).textContent).toBe('claude-opus-5-5 +2');
    });

    it('shows no "+N" when every agent used the shown model', async () => {
      const [first] = await open(
        withAgents([main('claude-sonnet-5-5'), sub('a', 1, { model: 'claude-sonnet-5-5' })], {
          models: ['claude-sonnet-5-5'],
        }),
      );

      expect(modelOf(first!).textContent).toBe('claude-sonnet-5-5');
    });

    it.each([
      ['the main model is empty', [main(''), sub('a', 1)], ['claude-haiku-5-5', 'claude-opus-5-5'], 'claude-haiku-5-5 +1'],
      ['there is no main entry', [sub('a', 1)], ['claude-haiku-5-5'], 'claude-haiku-5-5'],
      ['there are no agents', [], ['claude-opus-5-5', 'claude-haiku-5-5'], 'claude-opus-5-5 +1'],
      ['there is no model at all', [main('')], [], '—'],
    ] as [string, SessionAgent[], string[], string][])(
      'falls back to the first of the models, then to a dash, when %s',
      async (_case, agents, models, text) => {
        const [first] = await open(withAgents(agents, { models }));

        expect(modelOf(first!).textContent).toBe(text);
      },
    );

    it('lists main first, then the subagents by cost, an unpriced one last; a model-less one shows a dash', async () => {
      const [first] = await open(
        withAgents(
          [
            main('claude-opus-5-5', 2), // the API's order: main, then by id
            sub('agent-a', 0.5),
            sub('agent-b', null, { model: '' }),
            sub('agent-c', 3, { model: 'claude-sonnet-5-5' }),
            sub('agent-d', 1),
          ],
          { costUsd: 6.5 },
        ),
      );
      const tooltip = await hover(modelOf(first!));

      expect(agentRows(tooltip)).toEqual([
        ['main', 'claude-opus-5-5', '$2.00'],
        ['label agent-c', 'claude-sonnet-5-5', '$3.00'],
        ['label agent-d', 'claude-haiku-5-5', '$1.00'],
        ['label agent-a', 'claude-haiku-5-5', '$0.5000'],
        ['label agent-b', '—', '—'],
      ]);
    });

    it('keeps main first even when a subagent cost more', async () => {
      const [first] = await open(withAgents([main('claude-opus-5-5', 1), sub('agent-a', 5)], { costUsd: 6 }));
      const tooltip = await hover(modelOf(first!));

      expect(agentRows(tooltip).map(([name]) => name)).toEqual(['main', 'label agent-a']);
    });

    it('names a subagent without a label by the short form of its id', async () => {
      const [first] = await open(
        withAgents([main('claude-opus-5-5'), sub('a8a3b1e64a264d5bf', 0.25, { label: '' })], { costUsd: 1.25 }),
      );
      const tooltip = await hover(modelOf(first!));

      expect(agentRows(tooltip)[1]).toEqual(['a8a3b1e6', 'claude-haiku-5-5', '$0.2500']);
      expect(tooltip).not.toHaveTextContent('a8a3b1e64a');
    });

    it('wraps or clamps a long label and keeps the cost on one line, so the tooltip stays narrow', async () => {
      const label = 'general-purpose: ' + 'a very long task description '.repeat(10);
      const [first] = await open(withAgents([main('claude-opus-5-5'), sub('agent-a', 1, { label })], { costUsd: 2 }));
      const tooltip = await hover(modelOf(first!));

      const [text, cost] = within(tooltip).getAllByRole('listitem')[1]!.children;
      const [name, model] = text!.children;
      expect(name).toHaveTextContent(label.trim());
      expect(name).toHaveClass('line-clamp-2', 'break-words');
      expect(text).toHaveClass('min-w-0');
      expect(model).toHaveClass('font-mono', 'opacity-70');
      expect(cost).toHaveClass('tabular-nums', 'shrink-0');
    });

    it('widens its own tooltip, not the Tools one, and keeps the rows to compact lines', async () => {
      const [first] = await open();

      const tooltip = await hover(modelOf(first!));
      expect(tooltip.firstElementChild).toHaveClass('max-w-md'); // room for a typical label on one line
      expect(within(tooltip).getByRole('list')).toHaveClass('leading-4');
      expect(totalRow(tooltip)).toHaveClass('leading-4');
      fireEvent.mouseLeave(modelOf(first!));
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

      const tools = await hover(within(first!).getByText('1.3k'));
      expect(tools.firstElementChild).not.toHaveClass('max-w-md');
    });

    describe('with many agents', () => {
      /** main plus `count` subagents `sub-01…`, the API's id order, whose costs rise 1, 2, 3… so the last cost most. */
      const crowd = (count: number): SessionAgent[] => [
        main('claude-opus-5-5', 5),
        ...Array.from({ length: count }, (_, i) => sub(`sub-${String(i + 1).padStart(2, '0')}`, i + 1)),
      ];
      const total = (count: number) => 5 + (count * (count + 1)) / 2;

      it('shows 8 agents, main among them, then a "+N more" row with the hidden costs summed', async () => {
        const [first] = await open(withAgents(crowd(10), { costUsd: total(10) })); // 11 agents, $60
        const tooltip = await hover(modelOf(first!));

        const rows = agentRows(tooltip);
        expect(rows).toHaveLength(9);
        // main, then the 7 costliest subagents (sub-10 … sub-04), not the first 7 by id.
        expect(rows.slice(0, 8).map(([name]) => name)).toEqual([
          'main',
          ...[10, 9, 8, 7, 6, 5, 4].map((n) => `label sub-${String(n).padStart(2, '0')}`),
        ]);
        // sub-03, sub-02 and sub-01 are hidden: 3 + 2 + 1.
        expect(rows[8]).toEqual(['+3 more', '$6.00']);
        expect(tooltip).not.toHaveTextContent('sub-03');
      });

      it('has no "more" row at exactly 8 agents', async () => {
        const [first] = await open(withAgents(crowd(7), { costUsd: total(7) }));
        const tooltip = await hover(modelOf(first!));

        expect(agentRows(tooltip)).toHaveLength(8);
        expect(tooltip).not.toHaveTextContent('more');
      });

      it('puts the one agent over 8 behind "+1 more", main counted among the 8', async () => {
        const [first] = await open(withAgents(crowd(8), { costUsd: total(8) })); // 9 agents
        const tooltip = await hover(modelOf(first!));

        expect(agentRows(tooltip).at(-1)).toEqual(['+1 more', '$1.00']);
      });

      it('shows a dash for hidden agents that were never priced', async () => {
        const unpriced = Array.from({ length: 9 }, (_, i) => sub(`quiet-${i}`, null));
        const [first] = await open(withAgents([main('claude-opus-5-5', 4), ...unpriced], { costUsd: 4 }));
        const tooltip = await hover(modelOf(first!));

        expect(agentRows(tooltip).at(-1)).toEqual(['+2 more', '—']);
      });
    });

    it("ends with a total row that is the session's cost", async () => {
      const [first, second, third] = await open();

      const tooltip = await hover(modelOf(first!));
      expect(totalRow(tooltip)).toHaveTextContent(/^Total\$48\.20$/);
      expect(totalRow(tooltip).previousElementSibling).toBe(within(tooltip).getByRole('list')); // after every agent row
      expect(totalRow(tooltip).nextElementSibling).toBeNull();
      expect(totalRow(tooltip).lastElementChild).toHaveClass('tabular-nums');
      fireEvent.mouseLeave(modelOf(first!));
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

      expect(totalRow(await hover(modelOf(second!)))).toHaveTextContent(/^Total\$0\.0042$/);
      expect(third!.cells[2]!.textContent).toBe('—'); // no agents: no breakdown, so no total
    });

    it('shows a dash as the total of a session none of whose agents was priced', async () => {
      const [first] = await open(withAgents([main('claude-opus-5-5', null)], { costUsd: null }));
      const tooltip = await hover(modelOf(first!));

      expect(agentRows(tooltip)).toEqual([['main', 'claude-opus-5-5', '—']]);
      expect(totalRow(tooltip)).toHaveTextContent(/^Total—$/);
    });

    it('lists the models in a plain tooltip when there are no agents, and says "Unknown model" with none', async () => {
      const [first, , third] = await open(withAgents([]));

      expect(modelOf(first!)).toHaveAttribute('aria-label', 'claude-opus-5-5, claude-haiku-5-5');
      expect(await hover(modelOf(first!))).toHaveTextContent(/^claude-opus-5-5, claude-haiku-5-5$/);
      expect(modelOf(third!)).toHaveAttribute('aria-label', 'Unknown model');
    });

    it('opens the session when the cell is clicked', async () => {
      const [first] = await open();
      fireEvent.click(modelOf(first!));

      expect(window.location.hash).toBe('#/sessions/sess-newest');
    });
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

  describe('copy buttons', () => {
    const open = async () => {
      stubApi(() => ({ body: sessions }));
      renderWithTheme(<Sessions />);
      await screen.findByRole('table');
      return bodyRows() as [HTMLElement, HTMLElement, HTMLElement];
    };
    const click = (el: HTMLElement) =>
      act(async () => {
        fireEvent.click(el);
      });

    it('copies the whole session id, not the 8 characters shown, without opening the session', async () => {
      const writeText = stubClipboard();
      const [first] = await open();

      await click(within(first).getByRole('button', { name: 'Copy session id' }));
      expect(writeText).toHaveBeenCalledExactlyOnceWith('sess-newest');
      expect(window.location.hash).toBe('');
    });

    it('copies the whole directory, not the shortened one shown, without opening the session', async () => {
      const writeText = stubClipboard();
      const [first] = await open();

      await click(within(first).getByRole('button', { name: 'Copy directory' }));
      expect(writeText).toHaveBeenCalledExactlyOnceWith('/home/dev/projects/alpha/api/usage-monitor');
      expect(window.location.hash).toBe('');
    });

    it('has a button for each row, and none for the directory of a session without one', async () => {
      const [first, second, third] = await open();

      for (const row of [first, second, third]) {
        expect(within(row).getAllByRole('button', { name: 'Copy session id' })).toHaveLength(1);
      }
      expect(within(first).getAllByRole('button', { name: 'Copy directory' })).toHaveLength(1);
      expect(within(second).getAllByRole('button', { name: 'Copy directory' })).toHaveLength(1);
      expect(within(third).queryByRole('button', { name: 'Copy directory' })).not.toBeInTheDocument();
    });

    it('sits in the Session over Directory cell, before each value, and keeps the cell text as it was', async () => {
      const [first] = await open();
      const idButton = within(first).getByRole('button', { name: 'Copy session id' });
      const dirButton = within(first).getByRole('button', { name: 'Copy directory' });
      const sessionCell = idButton.closest('td')!;

      expect(sessionCell).toContainElement(dirButton);
      expect(sessionCell.textContent).toBe('sess-new…/api/usage-monitor');
      // Each line is [button][value].
      expect(within(sessionCell).getByLabelText('sess-newest').previousElementSibling).toContainElement(idButton);
      expect(
        within(sessionCell).getByLabelText('/home/dev/projects/alpha/api/usage-monitor').previousElementSibling,
      ).toContainElement(dirButton);
    });

    it('keeps the room for the button when there is none, so the values stay aligned', async () => {
      const [first, , third] = await open();
      const slotBefore = (row: HTMLElement, label: string) =>
        within(row.children[1] as HTMLElement).getByLabelText(label).previousElementSibling!;

      const withButton = slotBefore(first, '/home/dev/projects/alpha/api/usage-monitor');
      const without = slotBefore(third, 'Unknown directory');
      expect(without).toBeEmptyDOMElement();
      expect(without.className).toBe(withButton.className);
    });

    it('can be reached from the keyboard, and shows with the row hover or its own focus', async () => {
      const [first] = await open();
      const button = within(first).getByRole('button', { name: 'Copy session id' });

      button.focus();
      expect(button).toHaveFocus();
      expect(first).toHaveClass('group');
      expect(button).toHaveClass('group-hover:opacity-100', 'focus-visible:opacity-100');
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
