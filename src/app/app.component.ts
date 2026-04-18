import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommentaryService } from './core/commentary.service';
import { FeedMetricsService } from './core/feed-metrics.service';
import { QuoteStore, SortMode } from './core/quote-store';
import { ThemeService } from './core/theme.service';
import { FeedHealthComponent } from './components/feed-health/feed-health.component';
import { FeedStatusComponent } from './components/feed-status/feed-status.component';
import { MarketCommentaryComponent } from './components/market-commentary/market-commentary.component';
import { StockCardComponent } from './components/stock-card/stock-card.component';

interface SortOption {
  readonly value: SortMode;
  readonly label: string;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'symbol', label: 'A–Z' },
  { value: 'gainers', label: 'Gainers' },
  { value: 'losers', label: 'Losers' },
];

/**
 * The shell. It injects the store and renders it — no socket, no timer, no
 * subscription of its own.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    StockCardComponent,
    FeedStatusComponent,
    FeedHealthComponent,
    MarketCommentaryComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly theme = inject(ThemeService);

  protected readonly store = inject(QuoteStore);
  protected readonly commentary = inject(CommentaryService).commentary;
  protected readonly metrics = inject(FeedMetricsService).metrics;
  protected readonly currentTheme = this.theme.theme;
  protected readonly sortOptions = SORT_OPTIONS;

  protected toggleTheme(): void {
    this.theme.toggle();
  }
}
