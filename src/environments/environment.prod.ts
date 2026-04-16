/**
 * Production settings. The socket and API are same-origin, so a reverse proxy in
 * front of the built app is expected to route `/stream` and `/api` to the feed.
 */
const secure = typeof location !== 'undefined' && location.protocol === 'https:';
const host = typeof location !== 'undefined' ? location.host : 'localhost:7202';

export const environment = {
  production: true,
  feedUrl: `${secure ? 'wss' : 'ws'}://${host}/stream`,
  apiBase: '/api',
  demoIntervalMs: 2000,
  demoSeed: 20240695,
  commentaryRefreshMs: 60_000,
};
