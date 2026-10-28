import { useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { ThemeToggle } from './components/ThemeToggle';
import { hrefs, useRoute } from './route';
import { SessionDetail } from './views/SessionDetail';
import { Sessions } from './views/Sessions';
import { Summary } from './views/Summary';
import { Widget } from './views/Widget';

export function App() {
  const route = useRoute();
  const tab = route.name === 'summary' ? 'summary' : 'sessions'; // a session is under "Sessions"
  const current = (value: typeof tab) => (value === tab ? { 'aria-current': 'page' as const } : {});
  const routeKey = route.name === 'session' ? `session:${route.id}` : route.name;

  // A hash change does not reset scroll the way a page load does.
  // (Braces matter: current browsers return a Promise from scrollTo, which an effect must not return.)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [routeKey]);

  // The desktop app's floating window: the card alone, no app bar.
  if (route.name === 'widget') return <Widget />;

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider', boxShadow: 'none' }}
      >
        <Toolbar className="mx-auto w-full max-w-6xl gap-2 px-3 sm:gap-4 sm:px-6" disableGutters variant="dense">
          {/* Below 380 px the tabs and the theme toggle need the room; the name stays for screen readers. */}
          <Typography
            component="span"
            className="whitespace-nowrap max-[379px]:sr-only"
            sx={{ fontWeight: 500, letterSpacing: '-0.01em', fontSize: '1rem' }}
          >
            Usage Monitor
          </Typography>
          <nav aria-label="Views" className="ml-auto">
            <Tabs value={tab}>
              <Tab label="Sessions" value="sessions" component="a" href={hrefs.sessions} {...current('sessions')} />
              <Tab label="Summary" value="summary" component="a" href={hrefs.summary} {...current('summary')} />
            </Tabs>
          </nav>
          <ThemeToggle />
        </Toolbar>
      </AppBar>
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-8">
        {route.name === 'sessions' && <Sessions />}
        {route.name === 'session' && <SessionDetail key={route.id} id={route.id} />}
        {route.name === 'summary' && <Summary />}
      </main>
    </>
  );
}
