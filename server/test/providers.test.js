import assert from 'node:assert/strict';
import test from 'node:test';
import {
  availableProviders,
  createQuoteProvider,
  withSyntheticFallback,
} from '../src/providers/index.js';
import { createFinnhubProvider } from '../src/providers/finnhub.js';
import { loadSymbols } from '../src/symbols.js';
import { loadConfig } from '../src/config.js';

const symbols = loadSymbols();
const baseConfig = loadConfig({});

test('the registry exposes both quote providers', () => {
  assert.deepEqual(availableProviders().sort(), ['finnhub', 'synthetic']);
});

test('an unknown provider name fails loudly and lists the valid ones', () => {
  assert.throws(
    () => createQuoteProvider({ symbols, config: { ...baseConfig, quoteProvider: 'bloomberg' } }),
    /unknown QUOTE_PROVIDER "bloomberg".*synthetic/s,
  );
});

test('with no credentials the default provider is synthetic', () => {
  assert.equal(baseConfig.quoteProvider, 'synthetic');
  assert.equal(createQuoteProvider({ symbols, config: baseConfig }).name, 'synthetic');
});

test('a FINNHUB_API_KEY flips the default to the live provider', () => {
  assert.equal(loadConfig({ FINNHUB_API_KEY: 'abc' }).quoteProvider, 'finnhub');
});

test('the synthetic provider is returned unwrapped by the fallback helper', () => {
  const provider = createQuoteProvider({ symbols, config: baseConfig });
  assert.equal(withSyntheticFallback(provider, { symbols, config: baseConfig }), provider);
});

test('a failing live provider degrades to synthetic instead of dropping the tick', async () => {
  let notified = 0;
  const broken = {
    name: 'finnhub',
    requiresCredentials: true,
    async fetchQuotes() {
      throw new Error('429 rate limited');
    },
  };
  const guarded = withSyntheticFallback(broken, {
    symbols,
    config: baseConfig,
    onFallback: () => {
      notified += 1;
    },
  });
  const quotes = await guarded.fetchQuotes();
  assert.equal(quotes.length, symbols.length);
  assert.match(guarded.name, /degraded to synthetic/);
  await guarded.fetchQuotes();
  assert.equal(notified, 1, 'a sustained outage should log once, not once per tick');
});

test('the live provider maps a Finnhub quote onto the wire shape', async () => {
  const provider = createFinnhubProvider({
    symbols: [{ symbol: 'AAPL', name: 'Apple', referencePrice: 178 }],
    apiKey: 'k',
    fetchImpl: async (url) => ({
      ok: true,
      json: async () =>
        url.includes('/quote')
          ? { c: 190.5, h: 191, l: 188, pc: 185 }
          : { metric: { '52WeekHigh': 220, '52WeekLow': 150 } },
    }),
  });
  const [q] = await provider.fetchQuotes();
  assert.equal(q.current, 190.5);
  assert.equal(q.previousClose, 185);
  assert.equal(q.week52High, 220);
  assert.equal(q.changePercent, 2.97);
});

test('the 52-week metric is fetched once per symbol, not once per tick', async () => {
  let metricCalls = 0;
  const provider = createFinnhubProvider({
    symbols: [{ symbol: 'AAPL', name: 'Apple', referencePrice: 178 }],
    apiKey: 'k',
    fetchImpl: async (url) => {
      if (!url.includes('/quote')) metricCalls += 1;
      return {
        ok: true,
        json: async () =>
          url.includes('/quote')
            ? { c: 190, h: 191, l: 188, pc: 185 }
            : { metric: { '52WeekHigh': 220, '52WeekLow': 150 } },
      };
    },
  });
  for (let i = 0; i < 10; i += 1) await provider.fetchQuotes();
  assert.equal(metricCalls, 1);
});

test('a missing 52-week metric still yields a usable band', async () => {
  const provider = createFinnhubProvider({
    symbols: [{ symbol: 'AAPL', name: 'Apple', referencePrice: 178 }],
    apiKey: 'k',
    fetchImpl: async (url) => ({
      ok: url.includes('/quote'),
      status: 500,
      json: async () => ({ c: 100, h: 101, l: 99, pc: 100 }),
    }),
  });
  const [q] = await provider.fetchQuotes();
  assert.equal(q.week52High, 120);
  assert.equal(q.week52Low, 75);
});

test('a zero price from upstream is rejected rather than rendered', async () => {
  const provider = createFinnhubProvider({
    symbols: [{ symbol: 'AAPL', name: 'Apple', referencePrice: 178 }],
    apiKey: 'k',
    fetchImpl: async () => ({ ok: true, json: async () => ({ c: 0 }) }),
  });
  await assert.rejects(() => provider.fetchQuotes(), /no price for AAPL/);
});

test('the live provider refuses to start without a key', () => {
  assert.throws(
    () => createFinnhubProvider({ symbols, apiKey: '' }),
    /FINNHUB_API_KEY is required/,
  );
});
