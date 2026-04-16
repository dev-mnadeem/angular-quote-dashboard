import { InjectionToken, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { FeedMessage } from './feed-message';

/**
 * `connecting` — no frame has arrived yet.
 * `live`       — connected and receiving.
 * `retrying`   — the connection dropped and a reconnect is scheduled.
 * `demo`       — the feed could not be reached, so generated data is being shown.
 * `stopped`    — deliberately disconnected.
 */
export type FeedStatus = 'connecting' | 'live' | 'retrying' | 'demo' | 'stopped';

/**
 * Where quotes come from. The store depends on this interface and nothing else,
 * so swapping a WebSocket for SSE, long-polling, or a fixture in a test is a
 * provider change rather than a rewrite.
 */
export interface QuoteTransport {
  readonly status: Signal<FeedStatus>;
  /** Human-readable description of the active source, shown next to the status. */
  readonly source: Signal<string>;
  readonly messages: Observable<FeedMessage>;
  connect(): void;
  disconnect(): void;
}

export const QUOTE_TRANSPORT = new InjectionToken<QuoteTransport>('QUOTE_TRANSPORT');
