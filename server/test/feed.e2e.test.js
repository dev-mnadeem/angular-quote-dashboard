import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createFeedServer } from '../index.js';
import { loadConfig } from '../src/config.js';

const silent = { warn() {}, error() {}, log() {} };

/** Ports 7205-7209 are reserved for tests so they never collide with a dev feed. */
let nextPort = 7205;

async function withFeed(run, overrides = {}) {
  const config = { ...loadConfig({}), port: nextPort++, pollIntervalMs: 50, ...overrides };
  const feed = createFeedServer(config, silent);
  await feed.listen();
  try {
    return await run({ feed, config, base: `http://127.0.0.1:${config.port}` });
  } finally {
    await feed.close();
  }
}

function nextMessage(socket) {
  return new Promise((resolve, reject) => {
    socket.once('message', (data) => resolve(JSON.parse(data.toString())));
    socket.once('error', reject);
  });
}

test('a connecting client is sent the current board immediately', async () => {
  await withFeed(async ({ config }) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`);
    const frame = await nextMessage(socket);
    assert.equal(frame.type, 'snapshot');
    assert.equal(frame.provider, 'synthetic');
    assert.equal(frame.quotes.length, 4);
    assert.ok(frame.sequence >= 1);
    assert.ok(Array.isArray(frame.history['AAPL']));
    socket.close();
  });
});

test('one tick frame carries every symbol', async () => {
  await withFeed(async ({ config }) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`);
    await nextMessage(socket); // snapshot
    const tick = await nextMessage(socket);
    assert.equal(tick.type, 'tick');
    assert.equal(tick.quotes.length, 4);
    assert.deepEqual(tick.quotes.map((q) => q.symbol).sort(), ['AAPL', 'GOOGL', 'MSFT', 'TSLA']);
    socket.close();
  });
});

test('quote payloads carry everything a card renders', async () => {
  await withFeed(async ({ config }) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`);
    const { quotes } = await nextMessage(socket);
    for (const q of quotes) {
      for (const field of [
        'symbol',
        'name',
        'current',
        'dayHigh',
        'dayLow',
        'week52High',
        'week52Low',
        'previousClose',
        'change',
        'changePercent',
        'asOf',
      ]) {
        assert.ok(field in q, `${q.symbol} is missing ${field}`);
      }
    }
    socket.close();
  });
});

test('/healthz reports ok once quotes are flowing', async () => {
  await withFeed(async ({ base }) => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.symbols, 4);
    assert.equal(body.lastError, null);
  });
});

test('/metrics counts polls and connected clients', async () => {
  await withFeed(async ({ base, config }) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`);
    await nextMessage(socket);
    const body = await (await fetch(`${base}/metrics`)).json();
    assert.equal(body.clients, 1);
    assert.ok(body.polls >= 1);
    assert.equal(body.failures, 0);
    assert.ok(body.framesSent >= 1);
    socket.close();
  });
});

test('/commentary returns a sentence from the heuristic provider', async () => {
  await withFeed(async ({ base }) => {
    const res = await fetch(`${base}/commentary`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.provider, 'heuristic');
    assert.ok(body.text.length > 10);
    assert.ok(!Number.isNaN(Date.parse(body.generatedAt)));
  });
});

test('an unknown route answers 404 and lists what does exist', async () => {
  await withFeed(async ({ base }) => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.routes.includes('/healthz'));
  });
});

test('a disconnecting client is removed from the broadcast set', async () => {
  await withFeed(async ({ base, config }) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`);
    await nextMessage(socket);
    await new Promise((resolve) => {
      socket.on('close', resolve);
      socket.close();
    });
    // Give the server's close handler a turn to run.
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal((await (await fetch(`${base}/metrics`)).json()).clients, 0);
  });
});

test('prices move between ticks', async () => {
  await withFeed(async ({ config }) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`);
    await nextMessage(socket);
    const a = await nextMessage(socket);
    const b = await nextMessage(socket);
    assert.notDeepEqual(
      a.quotes.map((q) => q.current),
      b.quotes.map((q) => q.current),
    );
    socket.close();
  });
});

test('a socket error does not take the process down', async () => {
  await withFeed(async ({ config, base }) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/stream`);
    await nextMessage(socket);
    socket.terminate();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
  });
});
