import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarketState } from '../src/market.js';
import { createTicker } from '../src/ticker.js';

const silent = { warn() {}, error() {}, log() {} };

test('a poll that is still running does not start a second one', async () => {
  let starts = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const provider = {
    async fetchQuotes() {
      starts += 1;
      await gate;
      return [{ symbol: 'AAPL', current: 1 }];
    },
  };
  const ticker = createTicker({
    provider,
    market: createMarketState({ historyDepth: 5 }),
    intervalMs: 1000,
    onQuotes: () => {},
    logger: silent,
  });
  const first = ticker.tick();
  await ticker.tick();
  assert.equal(starts, 1, 'the overlapping poll should have been skipped');
  release();
  await first;
  await ticker.tick();
  assert.equal(starts, 2, 'a poll after the first finished should run');
});

test('a provider failure is counted and does not throw', async () => {
  const ticker = createTicker({
    provider: {
      async fetchQuotes() {
        throw new Error('upstream down');
      },
    },
    market: createMarketState({ historyDepth: 5 }),
    intervalMs: 1000,
    onQuotes: () => assert.fail('onQuotes must not fire on failure'),
    logger: silent,
  });
  await ticker.tick();
  assert.deepEqual(ticker.stats(), { polls: 0, failures: 1, lastError: 'upstream down' });
});

test('a successful poll after a failure clears lastError', async () => {
  let fail = true;
  const ticker = createTicker({
    provider: {
      async fetchQuotes() {
        if (fail) throw new Error('nope');
        return [{ symbol: 'AAPL', current: 1 }];
      },
    },
    market: createMarketState({ historyDepth: 5 }),
    intervalMs: 1000,
    onQuotes: () => {},
    logger: silent,
  });
  await ticker.tick();
  fail = false;
  await ticker.tick();
  assert.equal(ticker.stats().lastError, null);
  assert.equal(ticker.stats().polls, 1);
});

test('onQuotes receives the sequence number from the market', async () => {
  const seen = [];
  const ticker = createTicker({
    provider: {
      async fetchQuotes() {
        return [{ symbol: 'AAPL', current: 1 }];
      },
    },
    market: createMarketState({ historyDepth: 5 }),
    intervalMs: 1000,
    onQuotes: (_q, sequence) => seen.push(sequence),
    logger: silent,
  });
  await ticker.tick();
  await ticker.tick();
  assert.deepEqual(seen, [1, 2]);
});
