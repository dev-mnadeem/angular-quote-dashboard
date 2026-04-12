import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { StockQuote, Trend } from '../../models/stock-quote';
import { SparklineComponent } from '../sparkline/sparkline.component';

/**
 * One symbol. Entirely presentational: no timers, no subscriptions, no local
 * state beyond what is derived from its inputs, which is what lets it run under
 * OnPush and what makes it trivial to test.
 */
@Component({
  selector: 'app-stock-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, SparklineComponent],
  templateUrl: './stock-card.component.html',
  styleUrl: './stock-card.component.scss',
  host: {
    '[class.card-host--paused]': 'paused()',
  },
})
export class StockCardComponent {
  readonly quote = input.required<StockQuote>();
  readonly history = input<readonly number[]>([]);
  readonly trend = input<Trend>('flat');
  readonly paused = input(false);

  readonly pauseToggled = output<string>();

  /** Gain or loss against the previous close — the colour the card is read by. */
  protected readonly session = computed<Trend>(() => {
    const change = this.quote().changePercent;
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'flat';
  });

  /** Direction of the latest tick, which drives the brief highlight only. */
  protected readonly flash = computed(() => (this.paused() ? 'flat' : this.trend()));

  protected readonly arrow = computed(() =>
    this.session() === 'up' ? '▲' : this.session() === 'down' ? '▼' : '■',
  );

  /** Where the current price sits inside the day's range, as a percentage. */
  protected readonly dayPosition = computed(() => {
    const q = this.quote();
    const span = q.dayHigh - q.dayLow;
    if (span <= 0) return 50;
    return Math.min(100, Math.max(0, ((q.current - q.dayLow) / span) * 100));
  });

  protected readonly statusLabel = computed(() =>
    this.paused() ? 'Paused — showing the last price before pausing' : 'Receiving live updates',
  );

  protected toggle(): void {
    this.pauseToggled.emit(this.quote().symbol);
  }
}
