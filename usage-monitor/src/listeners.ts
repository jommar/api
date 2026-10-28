import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { createHandler, SECURITY_HEADERS } from './routes.ts';

const SOCKET_MODE = 0o600;
const LOOPBACK = '127.0.0.1';

export type ListenerOptions = { socket: string; port: number | null; distDir?: string };
// tcpPort is the port actually bound (so a requested 0 shows up resolved), or null when there is no TCP listener.
export type Listeners = { tcpPort: number | null; close: () => Promise<void> };

function isSocketAlive(file: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.connect(file);
    probe.once('connect', () => {
      probe.destroy();
      resolve(true);
    });
    probe.once('error', () => resolve(false));
  });
}

// Removes a socket left behind by a crashed run; refuses to touch a live socket or any other file.
async function removeStaleSocket(file: string): Promise<void> {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (!stat.isSocket()) throw new Error(`${file} exists and is not a socket`);
  if (await isSocketAlive(file)) throw new Error(`${file} is already in use by another process`);
  fs.unlinkSync(file);
}

function listen(server: http.Server, options: net.ListenOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options, resolve);
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}

// DNS rebinding: a page on another origin can point its own name at 127.0.0.1, but the browser then sends that name as Host.
function hostAllowed(host: string | undefined, port: number): boolean {
  return host !== undefined && [`${LOOPBACK}:${port}`, `localhost:${port}`].includes(host.toLowerCase());
}

// A page on another site can make the browser send requests to loopback. It cannot read the replies, but the queries still run and
// block ingest. The browser sets Sec-Fetch-Site and a page cannot change it; curl and the like send none, a typed URL is `none` and
// the dashboard's own requests are `same-origin`, so those pass. The one cross-site request allowed is a link into the dashboard.
function crossSiteRefused(req: http.IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site'];
  if (site !== 'cross-site' && site !== 'same-site') return false;
  const dashboardLoad = req.method === 'GET' && req.headers['sec-fetch-mode'] === 'navigate' && req.url?.split('?')[0] === '/';
  return !dashboardLoad;
}

function refuse(res: http.ServerResponse, status: number, reason: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(`${status} ${reason}\n`);
}

// The dashboard and the read API on loopback. Ingest stays on the socket, whose 0600 mode is its authentication.
// A port that cannot be bound only costs the dashboard: ingest must not die for it.
async function listenTcp(db: DatabaseSync, port: number, distDir?: string): Promise<http.Server | null> {
  const handle = createHandler(db, { distDir, readOnly: true });
  // requireHostHeader off: a request without Host reaches the guard below and gets its 421, not node's 400.
  const server = http.createServer({ requireHostHeader: false }, (req, res) => {
    if (!hostAllowed(req.headers.host, (server.address() as net.AddressInfo).port)) return refuse(res, 421, 'Misdirected Request');
    if (crossSiteRefused(req)) return refuse(res, 403, 'Forbidden');
    void handle(req, res);
  });
  try {
    await listen(server, { port, host: LOOPBACK });
    return server;
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code ?? (error as Error).message;
    console.warn(`usage-monitor: cannot listen on ${LOOPBACK}:${port} (${reason}); the dashboard is unavailable, the socket is unaffected`);
    return null;
  }
}

export async function startListeners(db: DatabaseSync, { socket, port, distDir }: ListenerOptions): Promise<Listeners> {
  const socketServer = http.createServer(createHandler(db, { distDir }));

  await removeStaleSocket(socket);
  // The socket is created owner-only; the chmod after listen states the same intent explicitly.
  const previousUmask = process.umask(0o177);
  try {
    await listen(socketServer, { path: socket });
  } finally {
    process.umask(previousUmask);
  }
  fs.chmodSync(socket, SOCKET_MODE);

  const tcpServer = port === null ? null : await listenTcp(db, port, distDir);
  return {
    tcpPort: tcpServer && (tcpServer.address() as net.AddressInfo).port,
    close: async () => {
      await Promise.all([socketServer, ...(tcpServer ? [tcpServer] : [])].map(closeServer));
      fs.rmSync(socket, { force: true });
    },
  };
}
