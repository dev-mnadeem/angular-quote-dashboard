/**
 * Drives the poll loop. The in-flight guard is the reason this is not a bare
 * `setInterval(poll, ms)`: a slow upstream would otherwise start a second poll
 * before the first finished and the overlap compounds until the process is
 * running nothing but fetches.
 */
export function createTicker({ provider, market, intervalMs, onQuotes, logger = console }) {
  let timer = null;
  let inFlight = false;
  let polls = 0;
  let failures = 0;
  let lastError = null;

  async function tick() {
    if (inFlight) {
      logger.warn('skipping poll: previous poll still running');
      return;
    }
    inFlight = true;
    try {
      const quotes = await provider.fetchQuotes();
      polls += 1;
      lastError = null;
      const sequence = market.record(quotes);
      onQuotes(quotes, sequence);
    } catch (err) {
      failures += 1;
      lastError = err.message ?? String(err);
      logger.error('poll failed: %s', lastError);
    } finally {
      inFlight = false;
    }
  }

  return {
    async start() {
      await tick();
      timer = setInterval(tick, intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    stats() {
      return { polls, failures, lastError };
    },
    tick,
  };
}
