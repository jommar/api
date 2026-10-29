import type { MouseEvent, ReactNode } from 'react';
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
import { fetchSessions, type SessionAgent, type ToolCount } from '../api';
import { CopyButton } from '../components/CopyButton';
import { HeadLabel } from '../components/HeadLabel';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { TableSkeleton } from '../components/TableSkeleton';
import { formatCompact, formatDateTime, formatExact, formatUsd, shortenPath } from '../format';
import { hrefs, navigate } from '../route';
import { usePolling } from '../usePolling';

const LIMIT = 50;
const SHORT_ID_LENGTH = 8;
const TOOLS_SHOWN = 8;
const AGENTS_SHOWN = 8;

/** The row opens its session, except for the clicks that mean something else: open in a new tab, a link or button of its own, selecting text. */
function openSession(e: MouseEvent<HTMLElement>, id: string) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.target instanceof Element && e.target.closest('a, button')) return;
  if (window.getSelection()?.toString()) return;
  navigate(hrefs.session(id));
}

const shortId = (id: string) => id.slice(0, SHORT_ID_LENGTH);

function SessionId({ id }: { id: string }) {
  return (
    <Tooltip title={id} placement="bottom-start">
      <span className="font-mono text-xs sm:text-[0.8125rem]">{shortId(id)}</span>
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

/** The room before a value for its copy button, held when the button is hidden or absent so the values stay put and aligned. */
function CopySlot({ children }: { children?: ReactNode }) {
  return <span className="flex w-[1.375rem] shrink-0 items-center">{children}</span>;
}

/** A shown value behind a button that copies the full `value` (none to copy: an empty slot). */
function Copyable({ value, label, children }: { value: string | null; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center">
      <CopySlot>{value && <CopyButton value={value} label={label} />}</CopySlot>
      {children}
    </div>
  );
}

/** Two related lines in one cell or header, the second muted; `bottomClassName` can drop it at narrow widths. */
function Stacked({
  top,
  bottom,
  bottomClassName = '',
}: {
  top: ReactNode;
  bottom: ReactNode;
  bottomClassName?: string;
}) {
  return (
    <>
      <div>{top}</div>
      <div className={`text-fg-muted ${bottomClassName}`}>{bottom}</div>
    </>
  );
}

/** A compact number whose exact value shows on hover, or `title` (richer content) in its place. */
function Count({ n, title = formatExact(n) }: { n: number; title?: ReactNode }) {
  return (
    <Tooltip title={title}>
      <span>{formatCompact(n)}</span>
    </Tooltip>
  );
}

/** The tools count's tooltip: the exact total, then the top tools with their counts and how many more there are. */
function ToolBreakdown({ total, toolCounts }: { total: number; toolCounts: ToolCount[] }) {
  const shown = toolCounts.slice(0, TOOLS_SHOWN);
  const more = toolCounts.length - shown.length;
  return (
    <>
      <div>
        {formatExact(total)} tool {total === 1 ? 'call' : 'calls'}
      </div>
      {total > 0 && shown.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {shown.map(({ tool, count }) => (
            <li key={tool} className="flex justify-between gap-3">
              <span className="min-w-0 font-mono break-all">{tool}</span>
              <span className="shrink-0 tabular-nums">{formatExact(count)}</span>
            </li>
          ))}
          {more > 0 && <li className="opacity-70">+{more} more</li>}
        </ul>
      )}
    </>
  );
}

/** Cost of a group of agents; null when none of them was priced. */
function sumCost(agents: SessionAgent[]): number | null {
  const priced = agents.filter((a) => a.costUsd !== null);
  return priced.length > 0 ? priced.reduce((sum, a) => sum + a.costUsd!, 0) : null;
}

/** An unpriced agent (null cost) after every priced one. */
const byCostDesc = (a: SessionAgent, b: SessionAgent) => (b.costUsd ?? -1) - (a.costUsd ?? -1);

/** The Model tooltip: each agent with its model and cost (main first, then the costliest subagents, capped), and the session total. */
function AgentBreakdown({ agents, costUsd }: { agents: SessionAgent[]; costUsd: number | null }) {
  const ordered = [
    ...agents.filter((a) => a.agent === 'main'),
    ...agents.filter((a) => a.agent !== 'main').sort(byCostDesc),
  ];
  const shown = ordered.slice(0, AGENTS_SHOWN);
  const hidden = ordered.slice(AGENTS_SHOWN);
  return (
    <>
      <ul className="flex flex-col gap-1 leading-4">
        {shown.map(({ agent, label, model, costUsd: agentCost }) => (
          <li key={agent} className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-2 break-words">{agent === 'main' ? 'main' : label || shortId(agent)}</div>
              <div className="font-mono break-all opacity-70">{model || '—'}</div>
            </div>
            <span className="shrink-0 tabular-nums">{formatUsd(agentCost)}</span>
          </li>
        ))}
        {hidden.length > 0 && (
          <li className="flex justify-between gap-3 opacity-70">
            <span>+{hidden.length} more</span>
            <span className="shrink-0 tabular-nums">{formatUsd(sumCost(hidden))}</span>
          </li>
        )}
      </ul>
      <div className="mt-1 flex justify-between gap-3 border-t border-white/25 pt-1 leading-4 font-medium">
        <span>Total</span>
        <span className="tabular-nums">{formatUsd(costUsd)}</span>
      </div>
    </>
  );
}

/** The main agent's model (the others' on hover), and how many other models the session used. */
function Models({ agents, models, costUsd }: { agents: SessionAgent[]; models: string[]; costUsd: number | null }) {
  const shown = agents.find((a) => a.agent === 'main')?.model || models[0] || '—';
  const others = models.filter((m) => m !== shown).length;
  const title =
    agents.length > 0 ? (
      <AgentBreakdown agents={agents} costUsd={costUsd} />
    ) : models.length > 0 ? (
      models.join(', ')
    ) : (
      'Unknown model'
    );
  return (
    <Tooltip title={title} placement="bottom-start" slotProps={{ tooltip: { className: 'max-w-md' } }}>
      <span className="block truncate font-mono text-[0.8125rem]">
        {shown}
        {others > 0 && ` +${others}`}
      </span>
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
                  <TableCell>
                    <div className="flex">
                      <CopySlot />
                      <div>
                        <Stacked top="Session" bottom="Directory" bottomClassName="hidden sm:block" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">Model</TableCell>
                  <TableCell align="right">
                    <Stacked
                      top={<HeadLabel short="Req." long="Requests" />}
                      bottom="Tools"
                      bottomClassName="hidden sm:block"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stacked top={<HeadLabel short="In" long="New in" />} bottom="Out" />
                  </TableCell>
                  <TableCell align="right" className="hidden md:table-cell">
                    <Stacked top="Cache read" bottom="Cache write" />
                  </TableCell>
                  <TableCell align="right">
                    <HeadLabel short="Est. $" long="Est. cost" />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((s) => (
                  <TableRow
                    key={s.session}
                    hover
                    className="group cursor-pointer"
                    onClick={(e) => openSession(e, s.session)}
                  >
                    <TableCell className="whitespace-nowrap">
                      <Link href={hrefs.session(s.session)} color="inherit" underline="hover" className="font-medium">
                        {formatDateTime(s.lastTs)}
                      </Link>
                      <div className="mt-0.5 text-fg-muted sm:hidden">
                        <Directory cwd={s.cwd} className="max-w-[5.5rem]" />
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-muted">
                      <Stacked
                        top={
                          <Copyable value={s.session} label="Copy session id">
                            <SessionId id={s.session} />
                          </Copyable>
                        }
                        bottom={
                          <Copyable value={s.cwd} label="Copy directory">
                            <Directory cwd={s.cwd} className="max-w-[16rem]" />
                          </Copyable>
                        }
                        bottomClassName="hidden sm:block"
                      />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-fg-muted lg:table-cell">
                      <Models agents={s.agents} models={s.models} costUsd={s.costUsd} />
                    </TableCell>
                    <TableCell align="right">
                      <Stacked
                        top={<Count n={s.requests} />}
                        bottom={
                          <Count n={s.tools} title={<ToolBreakdown total={s.tools} toolCounts={s.toolCounts} />} />
                        }
                        bottomClassName="hidden sm:block"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stacked top={<Count n={s.input} />} bottom={<Count n={s.output} />} />
                    </TableCell>
                    <TableCell align="right" className="hidden md:table-cell">
                      <Stacked top={<Count n={s.cacheRead} />} bottom={<Count n={s.cacheWrite} />} />
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
