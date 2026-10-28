import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';

/** First-load placeholder for a table: shown once, never on a refresh. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Paper className="flex flex-col gap-2 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={28} />
      ))}
    </Paper>
  );
}
