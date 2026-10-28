import { useEffect } from 'react';
import { fetchSessions, fetchSummary } from '../api';
import { formatCompact, formatExact, formatUsd } from '../format';
import { usePolling } from '../usePolling';

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

export function Widget() {
  const from = startOfToday();
  const summary = usePolling(`widget-summary:${from}`, (signal) => fetchSummary({ from }, signal));
  const latest = usePolling('widget-latest', (signal) => fetchSessions(1, signal));

  // The desktop window is transparent; only the card should show.
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  const days = summary.data?.byDay ?? [];
  const sum = (pick: (d: (typeof days)[number]) => number) => days.reduce((n, d) => n + pick(d), 0);
  const priced = days.filter((d) => d.costUsd !== null);
  const cost = priced.length > 0 ? priced.reduce((n, d) => n + (d.costUsd ?? 0), 0) : null;
  const tokens = sum((d) => d.input + d.output);
  const requests = sum((d) => d.requests);
  const session = latest.data?.[0];
  const offline = summary.error !== undefined && summary.data === undefined;

  return (
    <section
      aria-label="Usage"
      data-tauri-drag-region
      className="glass-widget flex h-screen cursor-default flex-col justify-between px-4 py-3 select-none"
    >
      <div data-tauri-drag-region className="flex items-center justify-between">
        <span data-tauri-drag-region className="text-[0.6875rem] font-semibold tracking-wide text-[var(--label-2)] uppercase">
          Today
        </span>
        {offline && (
          <span className="flex items-center gap-1 text-[0.6875rem] font-medium text-[#ff453a]">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            API offline
          </span>
        )}
      </div>
      <div data-tauri-drag-region className="flex justify-between gap-4">
        <Stat label="Cost today" value={formatUsd(cost)} />
        <Stat label="Tokens today" value={formatCompact(tokens)} title={formatExact(tokens)} />
        <Stat label="Requests today" value={formatCompact(requests)} title={formatExact(requests)} />
      </div>
      {session && (
        <div
          aria-label="Latest session"
          data-tauri-drag-region
          className="flex justify-between gap-3 border-t border-[var(--separator)] pt-2 text-[0.75rem] text-[var(--label-2)]"
        >
          <span data-tauri-drag-region className="truncate">
            {session.models[0] ?? '—'}
          </span>
          <span data-tauri-drag-region className="figure font-medium">
            {formatUsd(session.costUsd)}
          </span>
        </div>
      )}
    </section>
  );
}
