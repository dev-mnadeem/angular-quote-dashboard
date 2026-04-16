/**
 * Development settings. `npm start` proxies `/api` to the feed sidecar on 7202
 * (see `proxy.conf.json`), so nothing here hardcodes a backend host but the socket.
 */
export const environment = {
  production: false,
  /** WebSocket endpoint of the feed sidecar. */
  feedUrl: 'ws://localhost:7202/stream',
  /** Base path for the sidecar's HTTP routes, served through the dev-server proxy. */
  apiBase: '/api',
  /** Interval for the in-browser demo generator used when the feed is unreachable. */
  demoIntervalMs: 2000,
  /** Fixed seed keeps the offline demo reproducible. */
  demoSeed: 20240695,
  /** How often the market commentary strip refreshes. */
  commentaryRefreshMs: 60_000,
};
