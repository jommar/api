import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface Props {
  label: string;
  value: string;
  hint?: string;
  /** Title (hover) text, e.g. the exact figure behind a compact number. */
  title?: string;
  /** The one figure a page leads with: larger, in the accent colour. */
  lead?: boolean;
  className?: string;
}

export function StatCard({ label, value, hint, title, lead, className }: Props) {
  return (
    <Paper className={`p-4 ${className ?? ''}`} title={title}>
      <Typography variant="overline" component="div" color="textSecondary">
        {label}
      </Typography>
      <Typography
        component="div"
        sx={{
          fontSize: lead ? '2.125rem' : '1.5rem',
          fontWeight: 500,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: lead ? 'primary.main' : 'text.primary',
          mt: 0.5,
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" component="div" color="textSecondary" sx={{ mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
