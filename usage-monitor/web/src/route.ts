import { useMemo, useSyncExternalStore } from 'react';

export type Route = { name: 'sessions' } | { name: 'session'; id: string } | { name: 'summary' } | { name: 'widget' };

export const hrefs = {
  sessions: '#/',
  session: (id: string) => `#/sessions/${encodeURIComponent(id)}`,
  summary: '#/summary',
  /** The compact card the desktop app's floating window loads. */
  widget: '#/widget',
};

/** `#/` and anything unknown is the sessions list. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const session = /^\/sessions\/([^/]+)\/?$/.exec(path);
  if (session?.[1]) {
    try {
      return { name: 'session', id: decodeURIComponent(session[1]) };
    } catch {
      return { name: 'sessions' };
    }
  }
  if (/^\/summary\/?$/.test(path)) return { name: 'summary' };
  if (/^\/widget\/?$/.test(path)) return { name: 'widget' };
  return { name: 'sessions' };
}

export function navigate(href: string): void {
  window.location.hash = href.replace(/^#/, '');
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};
const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => parseRoute(hash), [hash]);
}
