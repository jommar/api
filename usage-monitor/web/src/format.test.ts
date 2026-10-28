import { describe, expect, it } from 'vitest';
import { eachDay, formatCompact, formatDateTime, formatDay, formatExact, formatUsd, shortenPath, utcDay } from './format';

describe('formatCompact', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1000, '1k'],
    [1234, '1.2k'],
    [1250, '1.3k'],
    [9999, '10k'],
    [12_345, '12.3k'],
    [99_949, '99.9k'],
    [99_950, '100k'],
    [123_456, '123k'],
    [999_499, '999k'],
    [999_500, '1M'],
    [999_950, '1M'],
    [1_000_000, '1M'],
    [1_234_567, '1.2M'],
    [167_440_000, '167M'],
    [999_999_999, '1B'],
    [2_500_000_000, '2.5B'],
    [3_000_000_000_000, '3T'],
    [1e15, '1000T'],
  ])('%d -> %s', (n, expected) => {
    expect(formatCompact(n)).toBe(expected);
  });

  it('keeps the sign', () => {
    expect(formatCompact(-1234)).toBe('-1.2k');
    expect(formatCompact(-5)).toBe('-5');
  });

  it('shows a dash for missing or non-finite numbers', () => {
    expect(formatCompact(null)).toBe('—');
    expect(formatCompact(undefined)).toBe('—');
    expect(formatCompact(NaN)).toBe('—');
    expect(formatCompact(Infinity)).toBe('—');
  });
});

describe('formatExact', () => {
  it('groups thousands', () => {
    expect(formatExact(0)).toBe('0');
    expect(formatExact(1234567)).toBe('1,234,567');
    expect(formatExact(null)).toBe('—');
  });
});

describe('formatUsd', () => {
  it.each([
    [0, '$0.00'],
    [0.00004, '<$0.0001'],
    [0.0001, '$0.0001'],
    [0.0042, '$0.0042'],
    [0.5, '$0.5000'],
    [0.99994, '$0.9999'],
    [0.99996, '$1.00'],
    [1, '$1.00'],
    [12.34, '$12.34'],
    [48.2, '$48.20'],
    [1234.5, '$1,234.50'],
  ])('%d -> %s', (n, expected) => {
    expect(formatUsd(n)).toBe(expected);
  });

  it('shows a dash when there is no price', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(undefined)).toBe('—');
    expect(formatUsd(NaN)).toBe('—');
  });

  it('treats a negative amount as zero rather than printing it', () => {
    expect(formatUsd(-1)).toBe('$0.00');
  });
});

describe('formatDateTime', () => {
  const now = Date.UTC(2026, 9, 28, 12, 0);

  it('uses local time (UTC in tests), 24 hours, without the year when it is the current one', () => {
    expect(formatDateTime(Date.UTC(2026, 9, 28, 17, 44), now)).toBe('Oct 28, 17:44');
    expect(formatDateTime(Date.UTC(2026, 0, 2, 5, 3), now)).toBe('Jan 2, 05:03');
  });

  it('does not show 24:00 at midnight', () => {
    expect(formatDateTime(Date.UTC(2026, 9, 28, 0, 5), now)).toBe('Oct 28, 00:05');
  });

  it('adds the year when it is not the current one', () => {
    expect(formatDateTime(Date.UTC(2025, 11, 31, 23, 59), now)).toBe('Dec 31, 2025, 23:59');
  });
});

describe('days', () => {
  it('formats a UTC day label regardless of the local zone', () => {
    expect(formatDay('2026-10-28')).toBe('Oct 28');
    expect(formatDay('2026-01-01')).toBe('Jan 1');
  });

  it('takes the UTC day of a timestamp', () => {
    expect(utcDay(Date.UTC(2026, 9, 28, 23, 59, 59))).toBe('2026-10-28');
    expect(utcDay(Date.UTC(2026, 9, 29, 0, 0, 0))).toBe('2026-10-29');
  });

  it('lists every day inclusive, across month and year ends', () => {
    expect(eachDay('2026-10-28', '2026-10-28')).toEqual(['2026-10-28']);
    expect(eachDay('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(eachDay('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it('lists nothing when the range is backwards', () => {
    expect(eachDay('2026-10-29', '2026-10-28')).toEqual([]);
  });
});

describe('shortenPath', () => {
  it.each([
    [null, '(unknown)'],
    [undefined, '(unknown)'],
    ['', '(unknown)'],
    ['/', '/'],
    ['/home/dev', '~'],
    ['/home/dev/proj', '~/proj'],
    ['/Users/dev/proj/app', '~/proj/app'],
    ['/srv/app', '/srv/app'],
    ['/tmp/scratch', '/tmp/scratch'],
    ['/home/dev/projects/alpha/api/usage-monitor', '…/api/usage-monitor'],
    ['/srv/apps/one/two/three', '…/two/three'],
  ])('%s -> %s', (cwd, expected) => {
    expect(shortenPath(cwd)).toBe(expected);
  });
});
