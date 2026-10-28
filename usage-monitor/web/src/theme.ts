import { createTheme } from '@mui/material/styles';

// "Cold Room": blue-charcoal ground, one cyan accent, one violet support hue for chart series 2.
// `accent` / primary is the contrast-passing text value; `accentFill` is the value for bars (3:1 or more against paper and panel2 in both modes).
// Light `text.secondary` is 5.1:1 on panel2 (table headers) and 5.7:1 on paper.
declare module '@mui/material/styles' {
  interface Palette {
    accentFill: string;
    panel2: string;
  }
  interface PaletteOptions {
    accentFill?: string;
    panel2?: string;
  }
}

const hairline = {
  light:
    '0 0 0 1px rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)',
  dark: '0 0 0 1px rgba(255, 255, 255, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 8px -2px rgba(0, 0, 0, 0.5)',
};

export const theme = createTheme({
  // The mode is an attribute on <html> (data-dark or data-light), so the app bar toggle can switch it (dark is the default,
  // see ThemeProvider in main.tsx). Nothing here uses Tailwind's `dark:` variant.
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#0e7490', dark: '#0a5a72', contrastText: '#ffffff' },
        secondary: { main: '#5b4fc4' },
        success: { main: '#036b4d' },
        error: { main: '#be123c' },
        warning: { main: '#8a6206' },
        info: { main: '#0e7490' },
        background: { default: '#fcfcfd', paper: '#ffffff' },
        text: { primary: '#14161a', secondary: '#62666f' },
        divider: '#e3e5e8',
        accentFill: '#0891b2',
        panel2: '#f1f2f4',
      },
    },
    dark: {
      palette: {
        primary: { main: '#67e8f9', dark: '#a5f3fc', contrastText: '#06222b' },
        secondary: { main: '#b3a9f0' },
        success: { main: '#34d399' },
        error: { main: '#fb7185' },
        warning: { main: '#fbbf24' },
        info: { main: '#67e8f9' },
        background: { default: '#111113', paper: '#1c1d20' },
        text: { primary: '#edeef0', secondary: '#949aa3' },
        divider: '#2e3035',
        accentFill: '#22d3ee',
        panel2: '#232427',
      },
    },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Roboto", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15 },
    h2: { fontSize: '1.0625rem', fontWeight: 500, letterSpacing: '-0.005em', lineHeight: 1.3 },
    body1: { fontSize: '0.9375rem' },
    body2: { fontSize: '0.8125rem' },
    caption: { fontSize: '0.75rem' },
    // Small uppercase labels track positive.
    overline: { fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.06em', lineHeight: 1.4 },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0 },
  },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          boxShadow: hairline.light,
          ...theme.applyStyles('dark', { boxShadow: hairline.dark }),
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontVariantNumeric: 'tabular-nums',
          borderBottomColor: theme.vars?.palette.divider,
          padding: '10px 16px',
          [theme.breakpoints.down('sm')]: { padding: '10px 5px' },
        }),
        head: ({ theme }) => ({
          position: 'relative', // contains the sr-only half of HeadLabel, which would otherwise widen the page
          fontSize: '0.6875rem',
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          color: theme.vars?.palette.text.secondary,
          backgroundColor: theme.vars?.palette.panel2,
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { '&:last-child td': { borderBottom: 0 } } },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 6,
          paddingInline: 14,
          paddingBlock: 6,
          textTransform: 'none',
          fontWeight: 500,
          color: theme.vars?.palette.text.secondary,
          '&.Mui-selected': {
            color: theme.vars?.palette.primary.main,
            backgroundColor: `color-mix(in srgb, ${theme.vars?.palette.accentFill} 16%, transparent)`,
          },
        }),
      },
    },
    MuiLink: {
      styleOverrides: {
        root: ({ theme }) => ({
          // The browser's default ring is a pale blue that nearly vanishes on the light ground.
          '&.Mui-focusVisible': {
            outline: `2px solid ${theme.vars?.palette.primary.main}`,
            outlineOffset: 2,
            borderRadius: 2,
          },
        }),
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiTab: { styleOverrides: { root: { minHeight: 48, fontWeight: 500, minWidth: 0 } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.75rem' } } },
  },
});
