import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommentaryCache } from '../src/commentary/index.js';
import { createHeuristicCommentary, summarise } from '../src/commentary/heuristic.js';
import { createAnthropicCommentary } from '../src/commentary/anthropic.js';

const board = (...pcts) =>
  pcts.map((changePercent, i) => ({
    symbol: `S${i}`,
    name: `Name${i}`,
    current: 100 + changePercent,
    previousClose: 100,
    changePercent,
  }));

test('summarise reports a broadly higher board', () => {
  const text = summarise(board(1.2, 0.8, 2.4));
  assert.match(text, /higher/);
  assert.match(text, /every name is up/);
});

test('summarise reports a broadly lower board', () => {
  const text = summarise(board(-1.2, -0.8, -2.4));
  assert.match(text, /lower/);
  assert.match(text, /every name is down/);
});

test('summarise calls a tiny spread little changed', () => {
  assert.match(summarise(board(0.05, -0.02, 0.01)), /little changed/);
});

test('summarise names the leader and the laggard', () => {
  const text = summarise(board(3, -4, 1));
  assert.match(text, /Name0 leads at \+3\.00%/);
  assert.match(text, /Name1 lags at -4\.00%/);
});

test('summarise handles an empty board', () => {
  assert.equal(summarise([]), 'No quotes have arrived yet.');
});

test('summarise handles a single symbol without claiming a leader', () => {
  const text = summarise(board(1.5));
  assert.match(text, /S0 is \+1\.50% on the session\./);
});

test('the cache generates once inside the TTL', async () => {
  let calls = 0;
  const provider = {
    name: 'counting',
    async write() {
      calls += 1;
      return `call ${calls}`;
    },
  };
  let clock = 0;
  const cache = createCommentaryCache({ provider, ttlMs: 1000, now: () => clock });
  assert.equal((await cache.get(board(1))).text, 'call 1');
  clock = 999;
  assert.equal((await cache.get(board(1))).text, 'call 1');
  clock = 1001;
  assert.equal((await cache.get(board(1))).text, 'call 2');
  assert.equal(calls, 2);
});

test('concurrent callers share one in-flight generation', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const provider = {
    name: 'slow',
    async write() {
      calls += 1;
      await gate;
      return 'done';
    },
  };
  const cache = createCommentaryCache({ provider, ttlMs: 1000, now: () => 0 });
  const all = Promise.all([cache.get(board(1)), cache.get(board(1)), cache.get(board(1))]);
  release();
  const results = await all;
  assert.equal(calls, 1);
  for (const r of results) assert.equal(r.text, 'done');
});

test('the heuristic provider needs no credentials', async () => {
  const provider = createHeuristicCommentary();
  assert.equal(provider.requiresCredentials, false);
  assert.match(await provider.write(board(1, -1)), /board/);
});

test('the model provider falls back to the heuristic when the API errors', async () => {
  const provider = createAnthropicCommentary({
    apiKey: 'test',
    model: 'claude-opus-5',
    client: {
      messages: {
        create: async () => {
          throw new Error('upstream exploded');
        },
      },
    },
  });
  assert.equal(await provider.write(board(2, -1)), summarise(board(2, -1)));
});

test('the model provider falls back when the request is declined', async () => {
  const provider = createAnthropicCommentary({
    apiKey: 'test',
    model: 'claude-opus-5',
    client: {
      messages: {
        create: async () => ({ stop_reason: 'refusal', content: [] }),
      },
    },
  });
  assert.equal(await provider.write(board(2, -1)), summarise(board(2, -1)));
});

test('the model provider returns the model sentence when the call succeeds', async () => {
  let seen = null;
  const provider = createAnthropicCommentary({
    apiKey: 'test',
    model: 'claude-opus-5',
    client: {
      messages: {
        create: async (req) => {
          seen = req;
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Tech leads. ' }] };
        },
      },
    },
  });
  assert.equal(await provider.write(board(2, -1)), 'Tech leads.');
  assert.equal(seen.model, 'claude-opus-5');
  assert.match(seen.messages[0].content, /S0 \(Name0\)/);
});
