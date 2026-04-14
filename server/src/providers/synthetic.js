import { makeQuote, round2 } from '../quote.js';

/**
 * mulberry32: a small, fast, well-distributed 32-bit PRNG. The point here is not
 * statistical quality but reproducibility — the same seed replays the same
 * session, so the demo looks identical on every machine and screenshots of it
 * are stable.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pulls the walk back toward the opening price so a long session cannot wander to zero. */
const MEAN_REVERSION = 0.02;

/**
 * Generates quotes with no network and no credentials. Each symbol walks from its
 * previous close, and day high/low are the running extremes of the walk rather
 * than fresh noise, so the numbers on a card stay internally consistent.
 */
export function createSyntheticProvider({ symbols, seed }) {
  const rand = mulberry32(seed);
  const state = new Map(
    symbols.map((s) => [
      s.symbol,
      {
        meta: s,
        price: s.referencePrice,
        high: s.referencePrice,
        low: s.referencePrice,
      },
    ]),
  );

  return {
    name: 'synthetic',
    requiresCredentials: false,
    async fetchQuotes() {
      return symbols.map((meta) => {
        const st = state.get(meta.symbol);
        const shock = (rand() - 0.5) * 2 * (meta.volatility ?? 0.005) * st.price;
        const pull = (meta.referencePrice - st.price) * MEAN_REVERSION;
        st.price = Math.max(1, st.price + shock + pull);
        st.high = Math.max(st.high, st.price);
        st.low = Math.min(st.low, st.price);
        return makeQuote({
          symbol: meta.symbol,
          name: meta.name,
          current: st.price,
          dayHigh: st.high,
          dayLow: st.low,
          week52High: round2(meta.referencePrice * 1.25),
          week52Low: round2(meta.referencePrice * 0.72),
          previousClose: meta.referencePrice,
        });
      });
    },
  };
}
