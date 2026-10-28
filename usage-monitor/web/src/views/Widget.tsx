import { useEffect, useState } from 'react';
import type { Session } from '../api';
import { fetchSessions, fetchSummary } from '../api';
import { resizeWindow } from '../desktopWindow';
import { formatCompact, formatDateTime, formatExact, formatUsd, shortenPath } from '../format';
import { usePolling } from '../usePolling';

/** Window sizes in logical pixels; COLLAPSED_SIZE matches the window the desktop app opens. */
export const COLLAPSED_SIZE = [300, 124] as const;
export const EXPANDED_SIZE = [340, 460] as const;
const RECENT = 5;

/** Local midnight: "today" is the user's day, so the summary's UTC days are summed from here. */
function startOfToday(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div aria-label={label} title={title} data-tauri-drag-region className="flex flex-col">
      <span data-tauri-drag-region className="figure text-[1.375rem] leading-7 font-semibold">
        {value}
      </span>
      <span data-tauri-drag-region className="text-[0.6875rem] font-medium text-[var(--label-2)]">
        {label.replace(' today', '')}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div aria-label={label} title={formatExact(value)} data-tauri-drag-region className="flex flex-col">
      <span data-tauri-drag-region className="figure text-[0.9375rem] font-semibold">
        {formatCompact(value)}
      </span>
      <span data-tauri-drag-region className="text-[0.625rem] font-medium whitespace-nowrap text-[var(--label-2)]">
        {label.replace(' today', '')}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 data-tauri-drag-region className="text-[0.6875rem] font-semibold tracking-wide text-[var(--label-2)] uppercase">
      {children}
    </h2>
  );
}

function RecentSession({ s }: { s: Session }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1 text-[0.75rem]">
      <span className="min-w-0">
        <span className="block truncate" title={s.cwd ?? undefined}>
          {shortenPath(s.cwd)}
        </span>
        <span className="block truncate text-[0.6875rem] text-[var(--label-2)]">
          {formatDateTime(s.lastTs)} · {s.models[0] ?? '—'}
        </span>
      </span>
      <span className="figure shrink-0 font-medium">{formatUsd(s.costUsd)}</span>
    </li>
  );
}

export function Widget() {
  const from = startOfToday();
  const summary = usePolling(`widget-summary:${from}`, (signal) => fetchSummary({ from }, signal));
  const recent = usePolling('widget-recent', (signal) => fetchSessions(RECENT, signal));
  const [expanded, setExpanded] = useState(false);

  // The desktop window is transparent; only the card should show.
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  const toggle = (next: boolean) => {
    setExpanded(next);
    const [width, height] = next ? EXPANDED_SIZE : COLLAPSED_SIZE;
    resizeWindow(width, height);
  };

  const days = summary.data?.byDay ?? [];
  const sum = (pick: (d: (typeof days)[number]) => number) => days.reduce((n, d) => n + pick(d), 0);
  const priced = days.filter((d) => d.costUsd !== null);
  const cost = priced.length > 0 ? priced.reduce((n, d) => n + (d.costUsd ?? 0), 0) : null;
  const tokens = sum((d) => d.input + d.output);
  const requests = sum((d) => d.requests);
  const session = recent.data?.[0];
  const offline = summary.error !== undefined && summary.data === undefined;

  return (
    <section
      aria-label={expanded ? 'Usage details' : 'Usage'}
      data-tauri-drag-region
      onDoubleClick={() => toggle(!expanded)}
      className="glass-widget flex h-screen cursor-default flex-col gap-3 px-4 py-3 select-none"
    >
      <div data-tauri-drag-region className="flex items-center justify-between">
        <span data-tauri-drag-region className="text-[0.6875rem] font-semibold tracking-wide text-[var(--label-2)] uppercase">
          Today
        </span>
        <span className="flex items-center gap-2">
          {offline && (
            <span className="flex items-center gap-1 text-[0.6875rem] font-medium text-[#ff453a]">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              API offline
            </span>
          )}
          {expanded && (
            <button
              type="button"
              aria-label="Collapse"
              title="Collapse (or double-click)"
              onClick={() => toggle(false)}
              onDoubleClick={(e) => e.stopPropagation()}
              className="grid size-5 place-items-center rounded-full text-[var(--label-2)] hover:bg-[var(--separator)]"
            >
              <svg aria-hidden viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 7.5 6 4.5l3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </span>
      </div>
      <div data-tauri-drag-region className="flex justify-between gap-4">
        <Stat label="Cost today" value={formatUsd(cost)} />
        <Stat label="Tokens today" value={formatCompact(tokens)} title={formatExact(tokens)} />
        <Stat label="Requests today" value={formatCompact(requests)} title={formatExact(requests)} />
      </div>

      {!expanded && session && (
        <div
          aria-label="Latest session"
          data-tauri-drag-region
          className="mt-auto flex justify-between gap-3 border-t border-[var(--separator)] pt-2 text-[0.75rem] text-[var(--label-2)]"
        >
          <span data-tauri-drag-region className="truncate">
            {session.models[0] ?? '—'}
          </span>
          <span data-tauri-drag-region className="figure font-medium">
            {formatUsd(session.costUsd)}
          </span>
        </div>
      )}

      {expanded && (
        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-[var(--separator)] px-4 pt-3">
          <div data-tauri-drag-region className="grid grid-cols-5 gap-2">
            <MiniStat label="Input today" value={sum((d) => d.input)} />
            <MiniStat label="Output today" value={sum((d) => d.output)} />
            <MiniStat label="Cache read today" value={sum((d) => d.cacheRead)} />
            <MiniStat label="Cache write today" value={sum((d) => d.cacheWrite)} />
            <MiniStat label="Tools today" value={sum((d) => d.tools)} />
          </div>

          <div className="flex flex-col gap-1">
            <SectionTitle>By model</SectionTitle>
            <table aria-label="Today by model" className="w-full text-[0.75rem]">
              <thead className="text-[0.625rem] text-[var(--label-2)]">
                <tr>
                  <th className="text-left font-medium">Model</th>
                  <th className="text-right font-medium">Req.</th>
                  <th className="text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {(summary.data?.byModel ?? []).map((m) => (
                  <tr key={m.model}>
                    <td className="max-w-0 truncate py-0.5" title={m.model}>
                      {m.model}
                    </td>
                    <td className="figure w-12 text-right">{formatCompact(m.requests)}</td>
                    <td className="figure w-16 text-right font-medium">{formatUsd(m.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1">
            <SectionTitle>Recent sessions</SectionTitle>
            <ul aria-label="Recent sessions" className="divide-y divide-[var(--separator)]">
              {(recent.data ?? []).map((s) => (
                <RecentSession key={s.session} s={s} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
