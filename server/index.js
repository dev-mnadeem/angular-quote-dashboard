import { createServer } from 'node:http';
import { loadConfig } from './src/config.js';
import { createCommentaryCache, createCommentaryProvider } from './src/commentary/index.js';
import { createHub } from './src/hub.js';
import { createRequestHandler } from './src/http.js';
import { createMarketState } from './src/market.js';
import { createQuoteProvider, withSyntheticFallback } from './src/providers/index.js';
import { loadSymbols } from './src/symbols.js';
import { createTicker } from './src/ticker.js';

/**
 * Composition root. Everything above is a factory that takes its collaborators
 * as arguments, which is what makes the unit tests able to run the whole feed
 * without opening a socket. This file is the only place they are wired together.
 */
export function createFeedServer(config = loadConfig(), logger = console) {
  const symbols = loadSymbols();

  const provider = withSyntheticFallback(createQuoteProvider({ symbols, config }), {
    symbols,
    config,
    onFallback: (err) =>
      logger.warn('quote provider failed, serving synthetic data: %s', err.message),
  });

  const commentary = createCommentaryCache({
    provider: createCommentaryProvider({
      config,
      onError: (err) => logger.warn('commentary provider failed, using heuristic: %s', err.message),
    }),
    ttlMs: config.commentaryTtlMs,
  });

  const market = createMarketState({ historyDepth: config.historyDepth });
  const hub = createHub({
    market,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    providerName: () => provider.name,
    logger,
  });
  const ticker = createTicker({
    provider,
    market,
    intervalMs: config.pollIntervalMs,
    onQuotes: (quotes, sequence) => hub.broadcast(quotes, sequence),
    logger,
  });

  const server = createServer(createRequestHandler({ market, hub, ticker, commentary }));
  hub.attach(server);

  return {
    market,
    hub,
    ticker,
    commentary,
    async listen() {
      await new Promise((resolve) => server.listen(config.port, config.host, resolve));
      logger.log(
        'feed listening on http://%s:%d  ws://%s:%d/stream  quotes=%s commentary=%s',
        config.host,
        config.port,
        config.host,
        config.port,
        provider.name,
        commentary.providerName,
      );
      await ticker.start();
      return server;
    },
    async close() {
      ticker.stop();
      hub.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

// `node server/index.js` starts the feed; importing it does not.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const feed = createFeedServer();
  feed.listen().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      feed.close().finally(() => process.exit(0));
    });
  }
}
