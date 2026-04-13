import catalogue from '../../../shared/symbols.json';

/**
 * The symbol universe is defined once, in `shared/symbols.json` at the repo root,
 * and read from there by both this app and the feed sidecar. Keeping two hand-
 * maintained lists in sync is exactly the kind of chore that silently rots.
 */
export interface SymbolMeta {
  readonly symbol: string;
  readonly name: string;
  readonly referencePrice: number;
  readonly volatility: number;
}

export const SYMBOLS: readonly SymbolMeta[] = catalogue.symbols;
