import { isStockQuote, StockQuote } from '../../models/stock-quote';

/**
 * The feed speaks two frames. `snapshot` is the whole board plus its price
 * history, sent the moment a client connects so nothing renders empty.
 * `tick` is every symbol's new price in a single frame — one frame per poll
 * rather than one per symbol, which is also one change-detection pass per poll.
 */
export interface SnapshotMessage {
  readonly type: 'snapshot';
  readonly sequence: number;
  readonly provider: string;
  readonly quotes: readonly StockQuote[];
  readonly history: Readonly<Record<string, readonly number[]>>;
}

export interface TickMessage {
  readonly type: 'tick';
  readonly sequence: number;
  readonly quotes: readonly StockQuote[];
}

export type FeedMessage = SnapshotMessage | TickMessage;

/**
 * Anything arriving over a socket is untrusted input. Returning `null` rather
 * than throwing means one malformed frame is dropped instead of tearing down
 * the stream that delivered it.
 */
export function parseFeedMessage(raw: string): FeedMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const frame = value as Record<string, unknown>;
  const quotes = frame['quotes'];
  if (!Array.isArray(quotes) || !quotes.every(isStockQuote)) return null;
  const sequence = typeof frame['sequence'] === 'number' ? frame['sequence'] : 0;

  if (frame['type'] === 'snapshot') {
    const history = frame['history'];
    return {
      type: 'snapshot',
      sequence,
      provider: typeof frame['provider'] === 'string' ? frame['provider'] : 'unknown',
      quotes,
      history: isHistory(history) ? history : {},
    };
  }
  if (frame['type'] === 'tick') {
    return { type: 'tick', sequence, quotes };
  }
  return null;
}

function isHistory(value: unknown): value is Record<string, number[]> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every(
    (series) => Array.isArray(series) && series.every((n) => typeof n === 'number'),
  );
}
