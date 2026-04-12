import { createAnthropicCommentary } from './anthropic.js';
import { createHeuristicCommentary } from './heuristic.js';

/**
 * Commentary providers share the quote providers' shape: named, registered, and
 * selected by config. A provider is `{ name, requiresCredentials, write(quotes) }`.
 */
const REGISTRY = {
  heuristic: () => createHeuristicCommentary(),
  anthropic: ({ config, onError }) =>
    createAnthropicCommentary({
      apiKey: config.anthropicKey,
      model: config.commentaryModel,
      onError,
    }),
};

export function createCommentaryProvider({ config, onError = () => {} }) {
  const factory = REGISTRY[config.commentaryProvider];
  if (!factory) {
    throw new Error(
      `unknown COMMENTARY_PROVIDER ${JSON.stringify(config.commentaryProvider)}; expected one of ${Object.keys(REGISTRY).join(', ')}`,
    );
  }
  return factory({ config, onError });
}

/**
 * Commentary is the only thing here that can cost money or take a second, so it
 * is generated on a timer rather than per request. Every client that asks inside
 * the TTL gets the same cached sentence, and concurrent callers share one
 * in-flight generation instead of each starting their own.
 */
export function createCommentaryCache({ provider, ttlMs, now = Date.now }) {
  let cached = null;
  let inFlight = null;

  return {
    get providerName() {
      return provider.name;
    },
    async get(quotes) {
      if (cached && now() - cached.at < ttlMs) return cached;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        try {
          const text = await provider.write(quotes);
          cached = { text, at: now(), provider: provider.name };
          return cached;
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    },
  };
}
