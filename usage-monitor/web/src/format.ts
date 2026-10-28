const UNITS = ['', 'k', 'M', 'B', 'T'];

// One decimal under 100, none above; trailing ".0" is dropped.
function roundScaled(v: number): number {
  return v < 100 ? Math.round(v * 10) / 10 : Math.round(v);
}

/** 999 -> "999", 1234 -> "1.2k", 1_250_000 -> "1.3M", 999_950 -> "1M". */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  let v = Math.abs(n);
  let unit = 0;
  while (unit < UNITS.length - 1 && roundScaled(v) >= 1000) {
    v /= 1000;
    unit += 1;
  }
  return `${sign}${unit === 0 ? Math.round(v) : roundScaled(v)}${UNITS[unit]}`;
}

/** 1234567 -> "1,234,567" (tooltips, where the exact figure matters). */
export function formatExact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd4 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** Estimated cost: $0.0042 under a dollar, $12.34 from a dollar up, "—" when there is no price. */
export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n <= 0) return usd2.format(0);
  if (n < 0.0001) return '<$0.0001';
  if (n < 1) {
    const s = usd4.format(n);
    if (s !== '$1.0000') return s;
  }
  return usd2.format(n);
}

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const dateTimeWithYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Local time, 24 h: "Oct 28, 17:44"; the year is added when it is not the current one. */
export function formatDateTime(ms: number, now: number = Date.now()): string {
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dateTime : dateTimeWithYear).format(ms);
}

const dayLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "2026-10-28" (a UTC day) -> "Oct 28". */
export function formatDay(day: string): string {
  return dayLabel.format(new Date(`${day}T00:00:00Z`));
}

/** The UTC `YYYY-MM-DD` of a millisecond timestamp. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Every UTC day from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) days.push(utcDay(t));
  return days;
}

/** "/home/me/.claude/api/usage-monitor" -> "…/api/usage-monitor"; home becomes "~". */
export function shortenPath(cwd: string | null | undefined): string {
  if (!cwd) return '(unknown)';
  const path = cwd.replace(/^\/(?:home|Users)\/[^/]+/, '~');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  if (parts.length <= 3) return path.startsWith('/') ? `/${parts.join('/')}` : parts.join('/');
  return `…/${parts.slice(-2).join('/')}`;
}
