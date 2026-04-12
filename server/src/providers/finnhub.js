import { METRIC_CACHE_TTL_MS, UPSTREAM_TIMEOUT_MS } from '../config.js';
import { makeQuote, round2 } from '../quote.js';

const BASE_URL = 'https://finnhub.io/api/v1';

/** Used when Finnhub has no 52-week metric for a symbol, so a card never renders blank. */
const FALLBACK_52W_HIGH_RATIO = 1.2;
const FALLBACK_52W_LOW_RATIO = 0.75;

/**
 * Live quotes from Finnhub. Two calls are needed per symbol — `/quote` every tick
 * and `/stock/metric` for the 52-week band — so the metric is cached for an hour.
 * Without that cache the free tier's rate limit is reached within minutes.
 */
export function createFinnhubProvider({ symbols, apiKey, fetchImpl = fetch, now = Date.now }) {
  if (!apiKey) throw new Error('FINNHUB_API_KEY is required for the finnhub provider');
  const metricCache = new Map();

  async function get(path) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetchImpl(`${BASE_URL}${path}${sep}token=${apiKey}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`finnhub ${path} responded ${res.status}`);
    return res.json();
  }

  async function band(symbol, current) {
    const cached = metricCache.get(symbol);
    if (cached && now() - cached.at < METRIC_CACHE_TTL_MS) return cached;
    try {
      const body = await get(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`);
      const metric = body.metric ?? {};
      const high = metric['52WeekHigh'];
      const low = metric['52WeekLow'];
      if (high != null && low != null) {
        const entry = { high: round2(high), low: round2(low), at: now() };
        metricCache.set(symbol, entry);
        return entry;
      }
    } catch {
      // Fall through to the ratio estimate — a missing band must not drop the tick.
    }
    return {
      high: round2(current * FALLBACK_52W_HIGH_RATIO),
      low: round2(current * FALLBACK_52W_LOW_RATIO),
      at: 0,
    };
  }

  async function one(meta) {
    const q = await get(`/quote?symbol=${encodeURIComponent(meta.symbol)}`);
    const current = q.c;
    if (!(current > 0)) throw new Error(`finnhub returned no price for ${meta.symbol}`);
    const { high, low } = await band(meta.symbol, current);
    return makeQuote({
      symbol: meta.symbol,
      name: meta.name,
      current,
      dayHigh: q.h > 0 ? q.h : current,
      dayLow: q.l > 0 ? q.l : current,
      week52High: high,
      week52Low: low,
      previousClose: q.pc > 0 ? q.pc : current,
    });
  }

  return {
    name: 'finnhub',
    requiresCredentials: true,
    async fetchQuotes() {
      // One round trip per symbol in parallel, not a serial loop: four symbols
      // took four sequential round trips before, which is most of a poll interval.
      const settled = await Promise.allSettled(symbols.map(one));
      const quotes = [];
      for (const [i, result] of settled.entries()) {
        if (result.status === 'fulfilled') quotes.push(result.value);
        else throw new Error(`${symbols[i].symbol}: ${result.reason?.message ?? result.reason}`);
      }
      return quotes;
    },
  };
}
