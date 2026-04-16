import { inject, Injector, Provider } from '@angular/core';
import { environment } from '../../environments/environment';
import { SYMBOLS } from './symbols';
import { HISTORY_DEPTH } from './quote-store';
import { FallbackQuoteTransport } from './transport/fallback-transport';
import { QUOTE_TRANSPORT } from './transport/quote-transport';
import { SyntheticQuoteTransport } from './transport/synthetic-transport';
import { WebSocketQuoteTransport } from './transport/websocket-transport';

/**
 * Builds the quote transport the app runs on: the real feed, backed by the
 * in-browser generator so the dashboard is never blank. A test or a Storybook
 * story overrides `QUOTE_TRANSPORT` with a fixture and changes nothing else.
 */
export function provideQuoteFeed(): Provider[] {
  return [
    {
      provide: QUOTE_TRANSPORT,
      useFactory: () =>
        new FallbackQuoteTransport(
          new WebSocketQuoteTransport({ url: environment.feedUrl }),
          new SyntheticQuoteTransport({
            symbols: SYMBOLS,
            seed: environment.demoSeed,
            intervalMs: environment.demoIntervalMs,
            historyDepth: HISTORY_DEPTH,
          }),
          inject(Injector),
        ),
    },
  ];
}
