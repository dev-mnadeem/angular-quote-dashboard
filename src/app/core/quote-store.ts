import { computed, DestroyRef, inject, Injectable, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StockQuote, Trend } from '../models/stock-quote';
import { FeedMessage } from './transport/feed-message';
import { FeedStatus, QUOTE_TRANSPORT } from './transport/quote-transport';

/** How many points a sparkline keeps. Matches the sidecar's default history depth. */
export const HISTORY_DEPTH = 40;

/** Moves smaller than this are called unchanged rather than up or down. */
const FLAT_BAND_PCT = 0.15;

export type SortMode = 'symbol' | 'gainers' | 'losers';

export interface BoardRow {
  readonly quote: StockQuote;
  readonly history: readonly number[];
  readonly trend: Trend;
  readonly paused: boolean;
}

/**
 * The single owner of feed state. Components read signals off this and render;
 * they never touch a socket, a timer or an RxJS subscription.
 *
 * Two things deserve calling out. First, pausing a card is handled here rather
 * than inside the card: a paused symbol keeps the quote it was frozen at even
 * though ticks keep arriving, which means the card component has no state and
 * no effect of its own. Second, the subscription and the transport are both torn
 * down through `DestroyRef`, so nothing survives the injector that created it.
 */
@Injectable({ providedIn: 'root' })
export class QuoteStore {
  private readonly transport = inject(QUOTE_TRANSPORT);

  private readonly live = signal<ReadonlyMap<string, StockQuote>>(new Map());
  private readonly frozen = signal<ReadonlyMap<string, StockQuote>>(new Map());
  private readonly series = signal<ReadonlyMap<string, readonly number[]>>(new Map());
  private readonly trends = signal<ReadonlyMap<string, Trend>>(new Map());
  private readonly pausedSymbols = signal<ReadonlySet<string>>(new Set());
  private readonly updatedAt = signal<string | null>(null);
  private readonly feedProvider = signal<string | null>(null);

  readonly status: Signal<FeedStatus> = this.transport.status;
  readonly source: Signal<string> = this.transport.source;
  readonly provider = this.feedProvider.asReadonly();
  readonly lastUpdated = this.updatedAt.asReadonly();
  readonly sortMode = signal<SortMode>('symbol');

  /** The board in display order: a paused row shows its frozen quote. */
  readonly rows = computed<readonly BoardRow[]>(() => {
    const live = this.live();
    const frozen = this.frozen();
    const paused = this.pausedSymbols();
    const series = this.series();
    const trends = this.trends();

    const rows = [...live.keys()].map((symbol) => ({
      quote: (paused.has(symbol) ? frozen.get(symbol) : undefined) ?? live.get(symbol)!,
      history: series.get(symbol) ?? [],
      trend: paused.has(symbol) ? ('flat' as Trend) : (trends.get(symbol) ?? 'flat'),
      paused: paused.has(symbol),
    }));

    switch (this.sortMode()) {
      case 'gainers':
        return rows.sort((a, b) => b.quote.changePercent - a.quote.changePercent);
      case 'losers':
        return rows.sort((a, b) => a.quote.changePercent - b.quote.changePercent);
      default:
        return rows.sort((a, b) => a.quote.symbol.localeCompare(b.quote.symbol));
    }
  });

  readonly isEmpty = computed(() => this.rows().length === 0);

  readonly advancing = computed(
    () => this.rows().filter((r) => r.quote.changePercent > FLAT_BAND_PCT).length,
  );
  readonly declining = computed(
    () => this.rows().filter((r) => r.quote.changePercent < -FLAT_BAND_PCT).length,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.transport.messages
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((message) => this.apply(message));
    // Without this the socket and its reconnect timer outlive the injector and
    // keep retrying forever with nobody listening.
    destroyRef.onDestroy(() => this.transport.disconnect());
    this.transport.connect();
  }

  togglePause(symbol: string): void {
    const paused = new Set(this.pausedSymbols());
    if (paused.has(symbol)) {
      paused.delete(symbol);
      const frozen = new Map(this.frozen());
      frozen.delete(symbol);
      this.frozen.set(frozen);
    } else {
      paused.add(symbol);
      const quote = this.live().get(symbol);
      if (quote) {
        const frozen = new Map(this.frozen());
        frozen.set(symbol, quote);
        this.frozen.set(frozen);
      }
    }
    this.pausedSymbols.set(paused);
  }

  setSortMode(mode: SortMode): void {
    this.sortMode.set(mode);
  }

  private apply(message: FeedMessage): void {
    if (message.type === 'snapshot') {
      this.feedProvider.set(message.provider);
      this.series.set(
        new Map(
          Object.entries(message.history).map(([symbol, values]) => [
            symbol,
            values.slice(-HISTORY_DEPTH),
          ]),
        ),
      );
    }

    const live = new Map(this.live());
    const trends = new Map(this.trends());
    const series = new Map(this.series());

    for (const quote of message.quotes) {
      const previous = live.get(quote.symbol);
      trends.set(quote.symbol, direction(previous, quote));
      live.set(quote.symbol, quote);

      const history = [...(series.get(quote.symbol) ?? []), quote.current];
      // Bounded: the page can stay open all day and this array cannot grow with it.
      series.set(quote.symbol, history.slice(-HISTORY_DEPTH));
    }

    this.live.set(live);
    this.trends.set(trends);
    this.series.set(series);
    this.updatedAt.set(message.quotes.at(0)?.asOf ?? new Date().toISOString());
  }
}

function direction(previous: StockQuote | undefined, next: StockQuote): Trend {
  if (previous) {
    if (next.current > previous.current) return 'up';
    if (next.current < previous.current) return 'down';
    return 'flat';
  }
  // First sight of a symbol: colour it against its previous close instead.
  if (next.changePercent > FLAT_BAND_PCT) return 'up';
  if (next.changePercent < -FLAT_BAND_PCT) return 'down';
  return 'flat';
}
