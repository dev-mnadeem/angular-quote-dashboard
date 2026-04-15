/** Below this the board is called flat rather than up or down. */
const FLAT_BAND_PCT = 0.15;

function pct(n) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/**
 * Turns the board into one sentence using only arithmetic, so the dashboard has
 * commentary with no API key, no network and no per-render cost. It is also the
 * reference the model-backed provider is held to: same input, same shape of output.
 */
export function summarise(quotes) {
  if (quotes.length === 0) return 'No quotes have arrived yet.';

  const sorted = [...quotes].sort((a, b) => b.changePercent - a.changePercent);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const advancing = quotes.filter((q) => q.changePercent > FLAT_BAND_PCT).length;
  const declining = quotes.filter((q) => q.changePercent < -FLAT_BAND_PCT).length;
  const mean = quotes.reduce((sum, q) => sum + q.changePercent, 0) / quotes.length;

  const tone = mean > FLAT_BAND_PCT ? 'higher' : mean < -FLAT_BAND_PCT ? 'lower' : 'little changed';
  const breadth =
    advancing === quotes.length
      ? 'every name is up'
      : declining === quotes.length
        ? 'every name is down'
        : `${advancing} up, ${declining} down`;

  if (best.symbol === worst.symbol) {
    return `${best.symbol} is ${pct(best.changePercent)} on the session.`;
  }
  return `The board is ${tone} (${breadth}, average ${pct(mean)}). ${best.name} leads at ${pct(best.changePercent)} and ${worst.name} lags at ${pct(worst.changePercent)}.`;
}

export function createHeuristicCommentary() {
  return {
    name: 'heuristic',
    requiresCredentials: false,
    async write(quotes) {
      return summarise(quotes);
    },
  };
}
