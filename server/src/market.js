/**
 * The in-memory view of the market: the latest quote per symbol plus a bounded
 * price history that backs the sparklines. Bounded is the important word — the
 * process runs for days and a client that connects on day two must not be sent
 * a two-day array.
 */
export function createMarketState({ historyDepth }) {
  const latest = new Map();
  const history = new Map();
  let sequence = 0;

  return {
    get sequence() {
      return sequence;
    },
    record(quotes) {
      sequence += 1;
      for (const quote of quotes) {
        latest.set(quote.symbol, quote);
        const series = history.get(quote.symbol) ?? [];
        series.push(quote.current);
        if (series.length > historyDepth) series.splice(0, series.length - historyDepth);
        history.set(quote.symbol, series);
      }
      return sequence;
    },
    quotes() {
      return [...latest.values()];
    },
    /** Snapshot of the history, copied so a caller cannot mutate the ring. */
    series() {
      return Object.fromEntries([...history].map(([symbol, values]) => [symbol, [...values]]));
    },
    get isEmpty() {
      return latest.size === 0;
    },
  };
}
