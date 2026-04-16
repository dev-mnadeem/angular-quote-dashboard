import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { loadSymbols } from '../src/symbols.js';

test('defaults are usable with a completely empty environment', () => {
  const config = loadConfig({});
  assert.equal(config.port, 7202);
  assert.equal(config.quoteProvider, 'synthetic');
  assert.equal(config.commentaryProvider, 'heuristic');
  assert.ok(config.pollIntervalMs > 0);
});

test('numeric settings are parsed from the environment', () => {
  const config = loadConfig({ PORT: '9999', POLL_INTERVAL_MS: '250' });
  assert.equal(config.port, 9999);
  assert.equal(config.pollIntervalMs, 250);
});

test('a nonsense numeric setting fails at startup, not at the first tick', () => {
  assert.throws(() => loadConfig({ PORT: 'eighty' }), /PORT must be a positive number/);
  assert.throws(() => loadConfig({ POLL_INTERVAL_MS: '-5' }), /must be a positive number/);
});

test('an ANTHROPIC_API_KEY flips commentary to the model provider', () => {
  assert.equal(loadConfig({ ANTHROPIC_API_KEY: 'sk-test' }).commentaryProvider, 'anthropic');
});

test('an explicit provider name overrides the credential-based default', () => {
  assert.equal(
    loadConfig({ ANTHROPIC_API_KEY: 'sk-test', COMMENTARY_PROVIDER: 'heuristic' })
      .commentaryProvider,
    'heuristic',
  );
});

test('the shared symbol file is well formed and shared with the app', () => {
  const symbols = loadSymbols();
  assert.ok(symbols.length >= 1);
  for (const s of symbols) {
    assert.equal(typeof s.symbol, 'string');
    assert.equal(typeof s.name, 'string');
    assert.ok(s.referencePrice > 0);
  }
});

test('a malformed symbol file is rejected with the offending entry', async () => {
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const dir = mkdtempSync(join(tmpdir(), 'symbols-'));
  const file = join(dir, 'symbols.json');
  writeFileSync(file, JSON.stringify({ symbols: [{ symbol: 'X' }] }));
  assert.throws(() => loadSymbols(pathToFileURL(file)), /malformed symbol entry/);
  writeFileSync(file, JSON.stringify({ symbols: [] }));
  assert.throws(() => loadSymbols(pathToFileURL(file)), /non-empty "symbols" array/);
});
