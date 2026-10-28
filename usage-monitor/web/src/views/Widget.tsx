import { useEffect } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
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
    <div aria-label={label} title={title} className="flex flex-col">
      <span className="text-base font-semibold tabular-nums">{value}</span>
      <span className="text-[0.6875rem] text-fg-muted">{label.replace(' today', '')}</span>
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
    <Paper
      component="section"
      aria-label="Usage"
      data-tauri-drag-region
      className="m-1 flex cursor-move flex-col gap-2 rounded-xl px-3 py-2 select-none"
    >
      <div data-tauri-drag-region className="flex items-center justify-between gap-3">
        <Typography component="span" className="text-xs font-medium text-fg-muted">
          Today
        </Typography>
        {offline && <span className="text-xs text-red-400">API offline</span>}
      </div>
      <div data-tauri-drag-region className="flex gap-4">
        <Stat label="Cost today" value={formatUsd(cost)} />
        <Stat label="Tokens today" value={formatCompact(tokens)} title={formatExact(tokens)} />
        <Stat label="Requests today" value={formatCompact(requests)} title={formatExact(requests)} />
      </div>
      {session && (
        <div aria-label="Latest session" data-tauri-drag-region className="flex justify-between gap-3 text-xs text-fg-muted">
          <span className="truncate font-mono">{session.models[0] ?? '—'}</span>
          <span className="tabular-nums">{formatUsd(session.costUsd)}</span>
        </div>
      )}
    </Paper>
  );
}
