import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyntheticProvider, mulberry32 } from '../src/providers/synthetic.js';
import { loadSymbols } from '../src/symbols.js';

const symbols = loadSymbols();

test('the same seed replays the same session', async () => {
  const a = createSyntheticProvider({ symbols, seed: 42 });
  const b = createSyntheticProvider({ symbols, seed: 42 });
  for (let i = 0; i < 25; i += 1) {
    const [qa, qb] = await Promise.all([a.fetchQuotes(), b.fetchQuotes()]);
    assert.deepEqual(
      qa.map((q) => q.current),
      qb.map((q) => q.current),
    );
  }
});

test('different seeds diverge', async () => {
  const a = createSyntheticProvider({ symbols, seed: 1 });
  const b = createSyntheticProvider({ symbols, seed: 2 });
  const [qa, qb] = await Promise.all([a.fetchQuotes(), b.fetchQuotes()]);
  assert.notDeepEqual(
    qa.map((q) => q.current),
    qb.map((q) => q.current),
  );
});

test('mulberry32 produces the value the browser generator is pinned to', () => {
  // src/app/core/random.spec.ts asserts this same constant, so the two copies
  // of the generator cannot drift into producing different demo data.
  assert.equal(mulberry32(42)(), 0.6011037519201636);
});

test('mulberry32 stays inside [0, 1)', () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 1000; i += 1) {
    const v = rand();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('day high and low bracket the current price', async () => {
  const provider = createSyntheticProvider({ symbols, seed: 99 });
  for (let i = 0; i < 50; i += 1) {
    for (const q of await provider.fetchQuotes()) {
      assert.ok(q.dayHigh >= q.current, `${q.symbol}: high ${q.dayHigh} < current ${q.current}`);
      assert.ok(q.dayLow <= q.current, `${q.symbol}: low ${q.dayLow} > current ${q.current}`);
    }
  }
});

test('mean reversion keeps a long session near the reference price', async () => {
  const provider = createSyntheticProvider({ symbols, seed: 5 });
  let last = [];
  for (let i = 0; i < 5000; i += 1) last = await provider.fetchQuotes();
  for (const q of last) {
    const meta = symbols.find((s) => s.symbol === q.symbol);
    const drift = Math.abs(q.current - meta.referencePrice) / meta.referencePrice;
    assert.ok(drift < 0.5, `${q.symbol} drifted ${(drift * 100).toFixed(1)}% from reference`);
  }
});

test('change and changePercent agree with previous close', async () => {
  const provider = createSyntheticProvider({ symbols, seed: 11 });
  for (const q of await provider.fetchQuotes()) {
    assert.equal(q.change, Math.round((q.current - q.previousClose) * 100) / 100);
    const expected = Math.round(((q.current - q.previousClose) / q.previousClose) * 10000) / 100;
    assert.equal(q.changePercent, expected);
  }
});

test('never produces a non-positive price', async () => {
  const wild = symbols.map((s) => ({ ...s, volatility: 5 }));
  const provider = createSyntheticProvider({ symbols: wild, seed: 3 });
  for (let i = 0; i < 500; i += 1) {
    for (const q of await provider.fetchQuotes()) assert.ok(q.current > 0);
  }
});
