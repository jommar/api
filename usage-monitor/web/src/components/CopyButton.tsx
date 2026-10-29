import { useEffect, useRef, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import SvgIcon from '@mui/material/SvgIcon';
import Tooltip from '@mui/material/Tooltip';

// Feather's copy and check (24x24, stroked), so no icon package is needed.
const COPY =
  'M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1';
const CHECK = 'M20 6L9 17l-5-5';

const COPIED_MS = 1500;

/**
 * Copies `value` and shows a check for a moment. Hidden until its `group` (a table row) is hovered or the
 * button is focused, except on touch screens, which cannot hover. Put it inside a `group` element.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // refused: show no check, so nothing claims it worked
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <Tooltip title={copied ? 'Copied' : label}>
      <IconButton
        size="small"
        onClick={copy}
        aria-label={label}
        className="p-0.5 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <SvgIcon
          sx={{
            fontSize: '0.875rem',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        >
          <path d={copied ? CHECK : COPY} />
        </SvgIcon>
      </IconButton>
    </Tooltip>
  );
}
