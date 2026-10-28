import type { MouseEvent } from 'react';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { fetchSessions } from '../api';
import { HeadLabel } from '../components/HeadLabel';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { TableSkeleton } from '../components/TableSkeleton';
import { formatCompact, formatDateTime, formatExact, formatUsd, shortenPath } from '../format';
import { hrefs, navigate } from '../route';
import { usePolling } from '../usePolling';

const LIMIT = 50;
const SHORT_ID_LENGTH = 8;

/** The row opens its session, except for the clicks that mean something else: open in a new tab, a link of its own, selecting text. */
function openSession(e: MouseEvent<HTMLElement>, id: string) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.target instanceof Element && e.target.closest('a')) return;
  if (window.getSelection()?.toString()) return;
  navigate(hrefs.session(id));
}

function SessionId({ id }: { id: string }) {
  return (
    <Tooltip title={id} placement="bottom-start">
      <span className="font-mono text-xs sm:text-[0.8125rem]">{id.slice(0, SHORT_ID_LENGTH)}</span>
    </Tooltip>
  );
}

function Directory({ cwd, className = '' }: { cwd: string | null; className?: string }) {
  return (
    <Tooltip title={cwd ?? 'Unknown directory'} placement="bottom-start">
      <span className={`block truncate font-mono text-[0.8125rem] ${className}`}>{shortenPath(cwd)}</span>
    </Tooltip>
  );
}

export function Sessions() {
  const { data, error, fetching, loading, retry } = usePolling('sessions', (signal) => fetchSessions(LIMIT, signal));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="sessions-title">
      <div>
        <Typography variant="h1" id="sessions-title">
          Sessions
        </Typography>
        <Typography color="textSecondary" className="mt-1">
          The {LIMIT} most recently active sessions, newest activity first. Costs are estimates (est.) from list prices.
        </Typography>
      </div>

      {error !== undefined && <ErrorState onRetry={retry} busy={fetching} stale={data !== undefined} />}
      {loading && <TableSkeleton />}
      {data && data.length === 0 && error === undefined && <EmptyState title="No sessions yet" />}
      {data && data.length > 0 && (
        <Paper>
          <TableContainer>
            <Table size="small" aria-label="Sessions">
              <TableHead>
                <TableRow>
                  <TableCell>Last activity</TableCell>
                  <TableCell>Session</TableCell>
                  <TableCell className="hidden sm:table-cell">Directory</TableCell>
                  <TableCell align="right">
                    <HeadLabel short="Req." long="Requests" />
                  </TableCell>
                  <TableCell align="right" className="hidden md:table-cell">
                    Tools
                  </TableCell>
                  <TableCell align="right">
                    <HeadLabel short="In" long="New in" />
                  </TableCell>
                  <TableCell align="right">Out</TableCell>
                  <TableCell align="right" className="hidden md:table-cell">
                    Cache read
                  </TableCell>
                  <TableCell align="right" className="hidden md:table-cell">
                    Cache write
                  </TableCell>
                  <TableCell align="right">
                    <HeadLabel short="Est. $" long="Est. cost" />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.session} hover className="cursor-pointer" onClick={(e) => openSession(e, s.session)}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={hrefs.session(s.session)} color="inherit" underline="hover" className="font-medium">
                        {formatDateTime(s.lastTs)}
                      </Link>
                      <div className="mt-0.5 text-fg-muted sm:hidden">
                        <Directory cwd={s.cwd} className="max-w-[5.5rem]" />
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-muted">
                      <SessionId id={s.session} />
                    </TableCell>
                    <TableCell className="hidden text-fg-muted sm:table-cell">
                      <Directory cwd={s.cwd} className="max-w-[20rem]" />
                    </TableCell>
                    <TableCell align="right" title={formatExact(s.requests)}>
                      {formatCompact(s.requests)}
                    </TableCell>
                    <TableCell align="right" className="hidden md:table-cell" title={formatExact(s.tools)}>
                      {formatCompact(s.tools)}
                    </TableCell>
                    <TableCell align="right" title={formatExact(s.input)}>
                      {formatCompact(s.input)}
                    </TableCell>
                    <TableCell align="right" title={formatExact(s.output)}>
                      {formatCompact(s.output)}
                    </TableCell>
                    <TableCell align="right" className="hidden md:table-cell" title={formatExact(s.cacheRead)}>
                      {formatCompact(s.cacheRead)}
                    </TableCell>
                    <TableCell align="right" className="hidden md:table-cell" title={formatExact(s.cacheWrite)}>
                      {formatCompact(s.cacheWrite)}
                    </TableCell>
                    <TableCell align="right" className="font-medium whitespace-nowrap">
                      {formatUsd(s.costUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </section>
  );
}
