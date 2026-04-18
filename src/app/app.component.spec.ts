import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { StockQuote } from './models/stock-quote';
import { FeedMessage } from './core/transport/feed-message';
import { FeedStatus, QUOTE_TRANSPORT, QuoteTransport } from './core/transport/quote-transport';

function quote(symbol: string, current: number, previousClose: number): StockQuote {
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
  readonly source = signal('ws://test/stream').asReadonly();
  connect(): void {
    // The fake is driven directly by the test.
  }

  disconnect(): void {
    // Nothing to tear down.
  }
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let transport: FakeTransport;
  let http: HttpTestingController;

  beforeEach(async () => {
    transport = new FakeTransport();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: QUOTE_TRANSPORT, useValue: transport },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppComponent);
  });

  afterEach(() => {
    http.match(() => true).forEach((req) => req.flush(null, { status: 500, statusText: 'x' }));
  });

  function el(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function push(...quotes: StockQuote[]): void {
    transport.subject.next({ type: 'tick', sequence: 1, quotes });
  }

  /** The commentary poll starts on a timer, so let one macrotask elapse first. */
  const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the empty state before any quote arrives', () => {
    const root = el();
    expect(root.querySelector('.empty')).not.toBeNull();
    expect(root.querySelectorAll('app-stock-card').length).toBe(0);
  });

  it('renders one card per symbol once quotes arrive', () => {
    push(quote('AAPL', 110, 100), quote('MSFT', 90, 100));
    expect(el().querySelectorAll('app-stock-card').length).toBe(2);
  });

  it('replaces the empty state once quotes arrive', () => {
    push(quote('AAPL', 110, 100));
    expect(el().querySelector('.empty')).toBeNull();
  });

  it('summarises breadth in the header', () => {
    push(quote('AAPL', 110, 100), quote('MSFT', 90, 100), quote('TSLA', 100, 100));
    expect(el().querySelector('.shell__subtitle')?.textContent).toContain('1 advancing');
    expect(el().querySelector('.shell__subtitle')?.textContent).toContain('1 declining');
  });

  it('shows the feed status pill', () => {
    expect(el().querySelector('app-feed-status')?.textContent).toContain('Live');
    transport.state.set('retrying');
    expect(el().querySelector('app-feed-status')?.textContent).toContain('Reconnecting');
  });

  it('reorders the board when a sort control is pressed', () => {
    push(quote('AAPL', 90, 100), quote('MSFT', 120, 100));
    const root = el();
    const tickers = (): (string | undefined)[] =>
      [...root.querySelectorAll('.card__ticker')].map((n) => n.textContent?.trim());
    expect(tickers()).toEqual(['AAPL', 'MSFT']);

    const gainers = [...root.querySelectorAll('.segmented__btn')].find(
      (b) => b.textContent?.trim() === 'Gainers',
    ) as HTMLButtonElement;
    gainers.click();
    fixture.detectChanges();
    expect(tickers()).toEqual(['MSFT', 'AAPL']);
  });

  it('pauses a card when its toggle is pressed', () => {
    push(quote('AAPL', 100, 100));
    const root = el();
    (root.querySelector('.card__pause') as HTMLButtonElement).click();
    push(quote('AAPL', 200, 100));
    fixture.detectChanges();
    expect(root.querySelector('.card__price')?.textContent).toContain('100.00');
    expect(root.querySelector('.card__pause-text')?.textContent).toContain('Paused');
  });

  it('shows commentary once the feed returns it', async () => {
    el();
    await nextTask();
    http
      .expectOne((r) => r.url.endsWith('/commentary'))
      .flush({
        text: 'The board is higher.',
        provider: 'heuristic',
        generatedAt: '2024-06-17T12:00:00.000Z',
      });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.note__text')?.textContent).toContain(
      'The board is higher.',
    );
  });

  it('hides the commentary strip when the feed cannot be reached', async () => {
    el();
    await nextTask();
    http
      .expectOne((r) => r.url.endsWith('/commentary'))
      .flush(null, { status: 503, statusText: 'x' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.note')).toBeNull();
  });

  it('toggles the theme', () => {
    const root = el();
    const before = document.documentElement.dataset['theme'];
    (root.querySelector('.icon-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.documentElement.dataset['theme']).not.toBe(before);
  });
});
