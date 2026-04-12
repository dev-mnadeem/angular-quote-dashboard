import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { StockQuote } from '../models/stock-quote';
import { QuoteStore } from './quote-store';
import { FeedMessage } from './transport/feed-message';
import { FeedStatus, QUOTE_TRANSPORT, QuoteTransport } from './transport/quote-transport';

function quote(symbol: string, current: number, previousClose = 100): StockQuote {
  return {
    symbol,
    name: `${symbol} Inc`,
    current,
    dayHigh: current + 1,
    dayLow: current - 1,
    week52High: current * 1.3,
    week52Low: current * 0.7,
    previousClose,
    change: current - previousClose,
    changePercent: ((current - previousClose) / previousClose) * 100,
    asOf: '2024-06-17T12:00:00.000Z',
  };
}

class FakeTransport implements QuoteTransport {
  readonly subject = new Subject<FeedMessage>();
  readonly messages = this.subject.asObservable();
  readonly state = signal<FeedStatus>('live');
  readonly status = this.state.asReadonly();
  readonly source = signal('fake').asReadonly();
  connects = 0;
  disconnects = 0;

  connect(): void {
    this.connects += 1;
  }

  disconnect(): void {
    this.disconnects += 1;
  }
}

describe('QuoteStore', () => {
  let transport: FakeTransport;
  let store: QuoteStore;

  beforeEach(() => {
    transport = new FakeTransport();
    TestBed.configureTestingModule({
      providers: [{ provide: QUOTE_TRANSPORT, useValue: transport }],
    });
    store = TestBed.inject(QuoteStore);
  });

  it('connects the transport when it is first injected', () => {
    expect(transport.connects).toBe(1);
  });

  it('starts empty', () => {
    expect(store.isEmpty()).toBeTrue();
    expect(store.rows()).toEqual([]);
  });

  function snapshot(provider: string, quotes: StockQuote[], history = {}): void {
    transport.subject.next({ type: 'snapshot', sequence: 1, provider, quotes, history });
  }

  it('takes a snapshot history as is, since it already ends with the current price', () => {
    snapshot('synthetic', [quote('AAPL', 101)], { AAPL: [99, 100, 101] });
    expect(store.provider()).toBe('synthetic');
    expect(store.rows().length).toBe(1);
    expect(store.rows()[0].history).toEqual([99, 100, 101]);
  });

  it('starts a sparkline at the quote when a snapshot carries no history for it', () => {
    snapshot('synthetic', [quote('AAPL', 101)], { AAPL: [] });
    expect(store.rows()[0].history).toEqual([101]);
  });

  it('replaces the demo board when the live feed sends its snapshot', () => {
    snapshot('browser synthetic', [quote('AAPL', 300), quote('DEMO', 50)], {
      AAPL: [290, 300],
      DEMO: [50],
    });
    transport.subject.next({ type: 'tick', sequence: 2, quotes: [quote('AAPL', 310)] });
    store.togglePause('AAPL');

    snapshot('synthetic', [quote('AAPL', 101)], { AAPL: [100, 101] });

    const [row] = store.rows();
    expect(store.rows().length).toBe(1);
    expect(row.quote.current).toBe(101);
    expect(row.paused).toBeTrue();
    expect(row.history).toEqual([100, 101]);
  });

  it('colours the first live snapshot against the previous close, not the demo price', () => {
    snapshot('browser synthetic', [quote('AAPL', 300)]);
    // 101 is far below the demo's 300, but 1% above the previous close.
    snapshot('synthetic', [quote('AAPL', 101, 100)]);
    expect(store.rows()[0].trend).toBe('up');
  });

  it('keeps a paused price when the same feed reconnects', () => {
    snapshot('synthetic', [quote('AAPL', 100)]);
    store.togglePause('AAPL');
    snapshot('synthetic', [quote('AAPL', 120)]);
    expect(store.rows()[0].quote.current).toBe(100);
  });

  it('bounds the history it keeps for a long-running page', () => {
    for (let i = 0; i < 200; i += 1) {
      transport.subject.next({ type: 'tick', sequence: i, quotes: [quote('AAPL', 100 + i)] });
    }
    expect(store.rows()[0].history.length).toBe(40);
  });

  it('marks a rising price as an up tick', () => {
    transport.subject.next({ type: 'tick', sequence: 1, quotes: [quote('AAPL', 100)] });
    transport.subject.next({ type: 'tick', sequence: 2, quotes: [quote('AAPL', 105)] });
    expect(store.rows()[0].trend).toBe('up');
  });

  it('marks a falling price as a down tick', () => {
    transport.subject.next({ type: 'tick', sequence: 1, quotes: [quote('AAPL', 105)] });
    transport.subject.next({ type: 'tick', sequence: 2, quotes: [quote('AAPL', 100)] });
    expect(store.rows()[0].trend).toBe('down');
  });

  it('colours a first sighting against the previous close', () => {
    transport.subject.next({ type: 'tick', sequence: 1, quotes: [quote('AAPL', 110, 100)] });
    expect(store.rows()[0].trend).toBe('up');
  });

  it('freezes a paused symbol at the price it was paused on', () => {
    transport.subject.next({ type: 'tick', sequence: 1, quotes: [quote('AAPL', 100)] });
    store.togglePause('AAPL');
    transport.subject.next({ type: 'tick', sequence: 2, quotes: [quote('AAPL', 150)] });

    expect(store.rows()[0].paused).toBeTrue();
    expect(store.rows()[0].quote.current).toBe(100);
  });

  it('shows the latest price again once a symbol is resumed', () => {
    transport.subject.next({ type: 'tick', sequence: 1, quotes: [quote('AAPL', 100)] });
    store.togglePause('AAPL');
    transport.subject.next({ type: 'tick', sequence: 2, quotes: [quote('AAPL', 150)] });
    store.togglePause('AAPL');

    expect(store.rows()[0].paused).toBeFalse();
    expect(store.rows()[0].quote.current).toBe(150);
  });

  it('pauses only the symbol that was toggled', () => {
    transport.subject.next({
      type: 'tick',
      sequence: 1,
      quotes: [quote('AAPL', 100), quote('MSFT', 200)],
    });
    store.togglePause('AAPL');
    transport.subject.next({
      type: 'tick',
      sequence: 2,
      quotes: [quote('AAPL', 150), quote('MSFT', 250)],
    });

    const rows = Object.fromEntries(store.rows().map((r) => [r.quote.symbol, r.quote.current]));
    expect(rows['AAPL']).toBe(100);
    expect(rows['MSFT']).toBe(250);
  });

  it('sorts alphabetically by default', () => {
    transport.subject.next({
      type: 'tick',
      sequence: 1,
      quotes: [quote('MSFT', 200), quote('AAPL', 100)],
    });
    expect(store.rows().map((r) => r.quote.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('sorts gainers first on request', () => {
    transport.subject.next({
      type: 'tick',
      sequence: 1,
      quotes: [quote('AAPL', 90, 100), quote('MSFT', 120, 100)],
    });
    store.setSortMode('gainers');
    expect(store.rows().map((r) => r.quote.symbol)).toEqual(['MSFT', 'AAPL']);
    store.setSortMode('losers');
    expect(store.rows().map((r) => r.quote.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('counts advancing and declining symbols', () => {
    transport.subject.next({
      type: 'tick',
      sequence: 1,
      quotes: [quote('AAPL', 120, 100), quote('MSFT', 80, 100), quote('TSLA', 100, 100)],
    });
    expect(store.advancing()).toBe(1);
    expect(store.declining()).toBe(1);
  });

  it('exposes the transport status and source', () => {
    expect(store.status()).toBe('live');
    expect(store.source()).toBe('fake');
    transport.state.set('retrying');
    expect(store.status()).toBe('retrying');
  });

  it('disconnects the transport when the injector is destroyed', () => {
    TestBed.resetTestingModule();
    expect(transport.disconnects).toBeGreaterThanOrEqual(1);
  });
});
