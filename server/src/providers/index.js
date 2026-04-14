import { createFinnhubProvider } from './finnhub.js';
import { createSyntheticProvider } from './synthetic.js';

/**
 * Quote providers are looked up by name, so adding a new market-data vendor means
 * adding one file and one entry here — nothing else in the sidecar changes.
 *
 * A provider is `{ name, requiresCredentials, fetchQuotes(): Promise<Quote[]> }`.
 */
const REGISTRY = {
  synthetic: ({ symbols, config }) => createSyntheticProvider({ symbols, seed: config.seed }),
  finnhub: ({ symbols, config }) => createFinnhubProvider({ symbols, apiKey: config.finnhubKey }),
};

export function availableProviders() {
  return Object.keys(REGISTRY);
}

export function createQuoteProvider({ symbols, config }) {
  const factory = REGISTRY[config.quoteProvider];
  if (!factory) {
    throw new Error(
      `unknown QUOTE_PROVIDER ${JSON.stringify(config.quoteProvider)}; expected one of ${availableProviders().join(', ')}`,
    );
  }
  return factory({ symbols, config });
}

/**
 * Wraps a credentialled provider so a vendor outage degrades to generated data
 * instead of an empty dashboard. The active source is reported on /healthz.
 */
export function withSyntheticFallback(primary, { symbols, config, onFallback = () => {} }) {
  if (!primary.requiresCredentials) return primary;
  const backup = createSyntheticProvider({ symbols, seed: config.seed });
  let degraded = false;
  return {
    get name() {
      return degraded ? `${primary.name} (degraded to ${backup.name})` : primary.name;
    },
    requiresCredentials: primary.requiresCredentials,
    async fetchQuotes() {
      try {
        const quotes = await primary.fetchQuotes();
        degraded = false;
        return quotes;
      } catch (err) {
        if (!degraded) onFallback(err);
        degraded = true;
        return backup.fetchQuotes();
      }
    },
  };
}
