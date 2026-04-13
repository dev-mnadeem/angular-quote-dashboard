/**
 * Every environment variable the feed reads is parsed here, once, with a named
 * default. Nothing else in the sidecar touches `process.env`.
 */

/** WebSocket frames older than this are pointless to deliver, so a slow client is dropped. */
export const MAX_CLIENT_BACKLOG_BYTES = 1 << 20; // 1 MiB

/** A client that misses this many consecutive heartbeats is assumed gone. */
export const MISSED_HEARTBEATS_BEFORE_TERMINATE = 2;

/** 52-week high/low barely moves intraday, so it is cached rather than re-fetched each tick. */
export const METRIC_CACHE_TTL_MS = 60 * 60 * 1000;

/** Upstream calls are abandoned at this point so a hung fetch cannot stall the poll loop. */
export const UPSTREAM_TIMEOUT_MS = 4000;

function int(env, name, fallback) {
  const raw = env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive number, got ${JSON.stringify(raw)}`);
  }
  return Math.trunc(n);
}

export function loadConfig(env = process.env) {
  const finnhubKey = env['FINNHUB_API_KEY'] ?? '';
  return {
    port: int(env, 'PORT', 7202),
    host: env['HOST'] ?? '127.0.0.1',
    pollIntervalMs: int(env, 'POLL_INTERVAL_MS', 2000),
    heartbeatIntervalMs: int(env, 'HEARTBEAT_INTERVAL_MS', 15000),
    /** History depth kept per symbol, which is what the client sparklines draw. */
    historyDepth: int(env, 'HISTORY_DEPTH', 40),
    /** Seeds the synthetic walk. A fixed seed makes the demo reproducible tick for tick. */
    seed: int(env, 'FEED_SEED', 20240695),
    finnhubKey,
    quoteProvider: env['QUOTE_PROVIDER'] ?? (finnhubKey ? 'finnhub' : 'synthetic'),
    anthropicKey: env['ANTHROPIC_API_KEY'] ?? '',
    commentaryProvider:
      env['COMMENTARY_PROVIDER'] ?? (env['ANTHROPIC_API_KEY'] ? 'anthropic' : 'heuristic'),
    commentaryModel: env['COMMENTARY_MODEL'] ?? 'claude-opus-5',
    /** Commentary is regenerated at most this often regardless of how many clients ask. */
    commentaryTtlMs: int(env, 'COMMENTARY_TTL_MS', 60000),
  };
}
