import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The symbol universe lives in `shared/symbols.json` at the repo root so the
 * Angular app and this sidecar cannot drift apart. The app imports it directly,
 * the sidecar reads it from disk.
 */
const SHARED_SYMBOLS = new URL('../../shared/symbols.json', import.meta.url);

export function loadSymbols(path = SHARED_SYMBOLS) {
  const parsed = JSON.parse(readFileSync(fileURLToPath(path), 'utf8'));
  if (!Array.isArray(parsed.symbols) || parsed.symbols.length === 0) {
    throw new Error('shared/symbols.json must contain a non-empty "symbols" array');
  }
  for (const s of parsed.symbols) {
    if (!s.symbol || !s.name || !(s.referencePrice > 0)) {
      throw new Error(`malformed symbol entry: ${JSON.stringify(s)}`);
    }
  }
  return parsed.symbols;
}
