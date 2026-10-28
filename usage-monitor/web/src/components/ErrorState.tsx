import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';

/** `stale`: older data is still on screen below this banner. `busy`: a poll is already in flight, so Retry waits. */
export function ErrorState({ onRetry, busy, stale }: { onRetry: () => void; busy?: boolean; stale?: boolean }) {
  return (
    <Alert
      severity="error"
      variant="outlined"
      action={
        <Button color="inherit" variant="outlined" size="small" disabled={busy} onClick={onRetry}>
          Retry
        </Button>
      }
    >
      <AlertTitle>Can't reach the usage API</AlertTitle>
      {stale ? 'Showing the last data received. Trying again every 5 s.' : 'Trying again every 5 s.'}
    </Alert>
  );
}
