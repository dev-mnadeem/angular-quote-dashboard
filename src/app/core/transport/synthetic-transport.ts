import { signal, Signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { StockQuote } from '../../models/stock-quote';
import { mulberry32 } from '../random';
import { SymbolMeta } from '../symbols';
import { FeedMessage } from './feed-message';
import { FeedStatus, QuoteTransport } from './quote-transport';

const MEAN_REVERSION = 0.02;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface SyntheticTransportOptions {
  readonly symbols: readonly SymbolMeta[];
  readonly seed: number;
  readonly intervalMs: number;
  readonly historyDepth: number;
}

/**
 * Generates the same kind of walk the sidecar does, entirely in the browser.
 * Its job is to keep the dashboard demonstrable when no feed is running — a
 * reviewer who clones the repo and runs only `npm start` still sees the product
 * rather than an empty grid.
 */
export class SyntheticQuoteTransport implements QuoteTransport {
  private readonly subject = new Subject<FeedMessage>();
  private readonly state = signal<FeedStatus>('stopped');
  private readonly label = signal('demo generator · no feed connected');
  private readonly prices = new Map<string, { price: number; high: number; low: number }>();
  private readonly history = new Map<string, number[]>();
  private rand: () => number = () => 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;

  readonly messages: Observable<FeedMessage> = this.subject.asObservable();
  readonly status: Signal<FeedStatus> = this.state.asReadonly();
  readonly source: Signal<string> = this.label.asReadonly();

  constructor(private readonly options: SyntheticTransportOptions) {}

  connect(): void {
    this.disconnect();
    this.rand = mulberry32(this.options.seed);
    this.prices.clear();
    this.history.clear();
    for (const meta of this.options.symbols) {
      this.prices.set(meta.symbol, {
        price: meta.referencePrice,
        high: meta.referencePrice,
        low: meta.referencePrice,
      });
      this.history.set(meta.symbol, []);
    }
    this.state.set('demo');
    this.emit('snapshot');
    this.timer = setInterval(() => this.emit('tick'), this.options.intervalMs);
  }

  disconnect(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.state.set('stopped');
  }

  private emit(type: 'snapshot' | 'tick'): void {
    this.sequence += 1;
    const quotes = this.options.symbols.map((meta) => this.step(meta));
    if (type === 'snapshot') {
      this.subject.next({
        type: 'snapshot',
        sequence: this.sequence,
        provider: 'browser synthetic',
        quotes,
        history: Object.fromEntries(this.history),
      });
    } else {
      this.subject.next({ type: 'tick', sequence: this.sequence, quotes });
    }
  }

  private step(meta: SymbolMeta): StockQuote {
    const st = this.prices.get(meta.symbol)!;
    const shock = (this.rand() - 0.5) * 2 * meta.volatility * st.price;
    const pull = (meta.referencePrice - st.price) * MEAN_REVERSION;
    st.price = Math.max(1, st.price + shock + pull);
    st.high = Math.max(st.high, st.price);
    st.low = Math.min(st.low, st.price);

    const series = this.history.get(meta.symbol)!;
    series.push(round2(st.price));
    if (series.length > this.options.historyDepth) series.shift();

    const current = round2(st.price);
    const previousClose = round2(meta.referencePrice);
    return {
      symbol: meta.symbol,
      name: meta.name,
      current,
      dayHigh: round2(st.high),
      dayLow: round2(st.low),
      week52High: round2(meta.referencePrice * 1.25),
      week52Low: round2(meta.referencePrice * 0.72),
      previousClose,
      change: round2(current - previousClose),
      changePercent: round2(((current - previousClose) / previousClose) * 100),
      asOf: new Date().toISOString(),
    };
  }
}
