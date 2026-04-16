import { computed, effect, Injector, Signal, untracked } from '@angular/core';
import { merge, Observable } from 'rxjs';
import { FeedMessage } from './feed-message';
import { FeedStatus, QuoteTransport } from './quote-transport';

/**
 * Prefers the real feed and falls back to generated data when it cannot be
 * reached — the browser-side mirror of `withSyntheticFallback` in the sidecar.
 *
 * The primary keeps retrying underneath: the moment the feed comes back the
 * backup is stopped and live quotes take over again, with no page reload.
 */
export class FallbackQuoteTransport implements QuoteTransport {
  readonly messages: Observable<FeedMessage>;
  readonly status: Signal<FeedStatus>;
  readonly source: Signal<string>;

  private backupRunning = false;

  constructor(
    private readonly primary: QuoteTransport,
    private readonly backup: QuoteTransport,
    injector: Injector,
  ) {
    this.messages = merge(primary.messages, backup.messages);
    this.status = computed(() =>
      primary.status() === 'demo' ? backup.status() : primary.status(),
    );
    this.source = computed(() =>
      primary.status() === 'demo' ? backup.source() : primary.source(),
    );

    effect(
      () => {
        const unreachable = primary.status() === 'demo';
        untracked(() => {
          if (unreachable && !this.backupRunning) {
            this.backupRunning = true;
            backup.connect();
          } else if (!unreachable && this.backupRunning) {
            this.backupRunning = false;
            backup.disconnect();
          }
        });
      },
      { injector },
    );
  }

  connect(): void {
    this.primary.connect();
  }

  disconnect(): void {
    this.primary.disconnect();
    this.backup.disconnect();
    this.backupRunning = false;
  }
}
