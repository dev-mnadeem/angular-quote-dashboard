export const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Builds the wire shape every provider must return. Keeping the construction in
 * one place means a new provider cannot invent a slightly different payload.
 */
export function makeQuote({
  symbol,
  name,
  current,
  dayHigh,
  dayLow,
  week52High,
  week52Low,
  previousClose,
}) {
  const price = round2(current);
  const close = round2(previousClose);
  return {
    symbol,
    name,
    current: price,
    dayHigh: round2(Math.max(dayHigh, price)),
    dayLow: round2(Math.min(dayLow, price)),
    week52High: round2(week52High),
    week52Low: round2(week52Low),
    previousClose: close,
    change: round2(price - close),
    changePercent: close === 0 ? 0 : round2(((price - close) / close) * 100),
    asOf: new Date().toISOString(),
  };
}
