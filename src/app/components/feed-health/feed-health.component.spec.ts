import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedHealthComponent } from './feed-health.component';
import { FeedMetrics } from '../../core/feed-metrics.service';

const base: FeedMetrics = {
  uptimeSeconds: 42,
  sequence: 12,
  polls: 12,
  failures: 0,
  lastError: null,
  clients: 2,
  framesSent: 24,
  clientsDropped: 0,
};

describe('FeedHealthComponent', () => {
  let fixture: ComponentFixture<FeedHealthComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FeedHealthComponent] }).compileComponents();
    fixture = TestBed.createComponent(FeedHealthComponent);
  });

  function render(metrics: FeedMetrics | null): HTMLElement {
    fixture.componentRef.setInput('metrics', metrics);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders nothing when the feed cannot be reached', () => {
    expect(render(null).querySelector('.health')).toBeNull();
  });

  it('shows poll, frame and subscriber counts', () => {
    const text = render(base).textContent ?? '';
    expect(text).toContain('12');
    expect(text).toContain('24');
    expect(text).toContain('Subscribers');
  });

  it('formats uptime in seconds under a minute', () => {
    expect(render(base).textContent).toContain('42s');
  });

  it('formats uptime in minutes and seconds under an hour', () => {
    expect(render({ ...base, uptimeSeconds: 185 }).textContent).toContain('3m 5s');
  });

  it('formats uptime in hours and minutes beyond an hour', () => {
    expect(render({ ...base, uptimeSeconds: 7500 }).textContent).toContain('2h 5m');
  });

  it('flags a non-zero failure count', () => {
    const el = render({ ...base, failures: 3 });
    expect(el.querySelector('.health__item--bad')).not.toBeNull();
  });

  it('shows the last error only when there is one', () => {
    expect(render(base).textContent).not.toContain('Last error');
    expect(render({ ...base, lastError: '429 rate limited' }).textContent).toContain(
      '429 rate limited',
    );
  });
});
