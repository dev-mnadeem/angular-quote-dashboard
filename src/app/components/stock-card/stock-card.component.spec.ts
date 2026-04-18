import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockQuote } from '../../models/stock-quote';
import { StockCardComponent } from './stock-card.component';

const base: StockQuote = {
  symbol: 'AAPL',
  name: 'Apple',
  current: 180.25,
  dayHigh: 182,
  dayLow: 178,
  week52High: 220.5,
  week52Low: 140.25,
  previousClose: 178,
  change: 2.25,
  changePercent: 1.26,
  asOf: '2024-06-17T12:00:00.000Z',
};

describe('StockCardComponent', () => {
  let fixture: ComponentFixture<StockCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StockCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(StockCardComponent);
  });

  function render(
    quote: Partial<StockQuote> = {},
    inputs: Record<string, unknown> = {},
  ): HTMLElement {
    fixture.componentRef.setInput('quote', { ...base, ...quote });
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the ticker, the name and the price', () => {
    const el = render();
    expect(el.querySelector('.card__ticker')?.textContent).toContain('AAPL');
    expect(el.querySelector('.card__name')?.textContent).toContain('Apple');
    expect(el.querySelector('.card__price')?.textContent).toContain('180.25');
  });

  it('marks a gain as an up session', () => {
    expect(render().querySelector('.card')?.getAttribute('data-session')).toBe('up');
  });

  it('marks a loss as a down session', () => {
    const el = render({ changePercent: -2.1, change: -3.8, current: 174.2 });
    expect(el.querySelector('.card')?.getAttribute('data-session')).toBe('down');
  });

  it('marks an unchanged price as flat', () => {
    expect(
      render({ changePercent: 0, change: 0 }).querySelector('.card')?.getAttribute('data-session'),
    ).toBe('flat');
  });

  it('pairs the colour with an arrow so direction survives greyscale', () => {
    expect(render().querySelector('.card__arrow')?.textContent?.trim()).toBe('▲');
    expect(render({ changePercent: -1 }).querySelector('.card__arrow')?.textContent?.trim()).toBe(
      '▼',
    );
  });

  it('places the day-range marker between the day low and high', () => {
    const marker = render().querySelector('.card__range-marker') as HTMLElement;
    // 180.25 sits 56.25% of the way from 178 to 182.
    expect(marker.style.left).toBe('56.25%');
  });

  it('centres the day-range marker when the range has collapsed', () => {
    const el = render({ dayHigh: 180.25, dayLow: 180.25 });
    expect((el.querySelector('.card__range-marker') as HTMLElement).style.left).toBe('50%');
  });

  it('emits the symbol when the pause button is pressed', () => {
    const el = render();
    const emitted: string[] = [];
    fixture.componentInstance.pauseToggled.subscribe((s) => emitted.push(s));
    (el.querySelector('.card__pause') as HTMLButtonElement).click();
    expect(emitted).toEqual(['AAPL']);
  });

  it('reads Live when running and Paused when paused', () => {
    expect(render().querySelector('.card__pause-text')?.textContent).toContain('Live');
    expect(render({}, { paused: true }).querySelector('.card__pause-text')?.textContent).toContain(
      'Paused',
    );
  });

  it('reports the pause state to assistive technology', () => {
    const el = render({}, { paused: true });
    expect(el.querySelector('.card__pause')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('suppresses the tick flash while paused', () => {
    const el = render({}, { paused: true, trend: 'up' });
    expect(el.querySelector('.card')?.getAttribute('data-flash')).toBe('flat');
  });

  it('shows the tick flash while running', () => {
    const el = render({}, { trend: 'down' });
    expect(el.querySelector('.card')?.getAttribute('data-flash')).toBe('down');
  });

  it('announces only the price region, not the whole card', () => {
    const el = render();
    expect(el.querySelector('.card')?.getAttribute('aria-live')).toBeNull();
    expect(el.querySelector('.card__price-block')?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders the 52-week band and the previous close', () => {
    const text = render().querySelector('.card__stats')?.textContent ?? '';
    expect(text).toContain('220.50');
    expect(text).toContain('140.25');
    expect(text).toContain('178.00');
  });
});
