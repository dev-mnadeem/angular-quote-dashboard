import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarketState } from '../src/market.js';

const quote = (symbol, current) => ({ symbol, name: symbol, current });

test('history is bounded to the configured depth', () => {
  const market = createMarketState({ historyDepth: 5 });
  for (let i = 0; i < 100; i += 1) market.record([quote('AAPL', i)]);
  assert.equal(market.series()['AAPL'].length, 5);
  assert.deepEqual(market.series()['AAPL'], [95, 96, 97, 98, 99]);
});

test('sequence increments once per recorded batch, not once per quote', () => {
  const market = createMarketState({ historyDepth: 10 });
  market.record([quote('AAPL', 1), quote('MSFT', 2)]);
  market.record([quote('AAPL', 3), quote('MSFT', 4)]);
  assert.equal(market.sequence, 2);
});

test('latest quote replaces the previous one', () => {
  const market = createMarketState({ historyDepth: 10 });
  market.record([quote('AAPL', 1)]);
  market.record([quote('AAPL', 2)]);
  assert.equal(market.quotes().length, 1);
  assert.equal(market.quotes()[0].current, 2);
});

test('series() hands out a copy the caller cannot use to corrupt the ring', () => {
  const market = createMarketState({ historyDepth: 3 });
  market.record([quote('AAPL', 1)]);
  market.series()['AAPL'].push(999);
  assert.deepEqual(market.series()['AAPL'], [1]);
});

test('starts empty', () => {
  assert.equal(createMarketState({ historyDepth: 3 }).isEmpty, true);
});
