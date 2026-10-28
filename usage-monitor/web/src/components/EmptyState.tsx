import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export function EmptyState({ title = 'Nothing here yet', children }: { title?: string; children?: ReactNode }) {
  return (
    <Paper className="px-5 py-8 sm:px-8" role="status">
      <Typography variant="h2" component="p">
        {title}
      </Typography>
      <Typography color="textSecondary" className="mt-1 max-w-prose">
        {children ?? (
          <>
            No usage recorded yet. Set <code className="font-mono text-[0.9em]">apiSocket</code> in the usage-monitor
            mod to start reporting.
          </>
        )}
      </Typography>
    </Paper>
  );
}
