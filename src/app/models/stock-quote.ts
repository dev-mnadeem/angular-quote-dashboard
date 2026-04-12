/** One symbol's state as it arrives on the wire. Mirrors `makeQuote` in the feed sidecar. */
export interface StockQuote {
  readonly symbol: string;
  readonly name: string;
  readonly current: number;
  readonly dayHigh: number;
  readonly dayLow: number;
  readonly week52High: number;
  readonly week52Low: number;
  readonly previousClose: number;
  /** Absolute move against the previous close. */
  readonly change: number;
  /** Percentage move against the previous close. */
  readonly changePercent: number;
  /** ISO timestamp the feed stamped on this quote. */
  readonly asOf: string;
}

/** Direction of the most recent price move, used only for the flash colour. */
export type Trend = 'up' | 'down' | 'flat';

export function isStockQuote(value: unknown): value is StockQuote {
  if (typeof value !== 'object' || value === null) return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q['symbol'] === 'string' &&
    q['symbol'].length > 0 &&
    typeof q['name'] === 'string' &&
    typeof q['current'] === 'number' &&
    Number.isFinite(q['current'])
  );
}
