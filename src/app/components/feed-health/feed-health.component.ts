import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FeedMetrics } from '../../core/feed-metrics.service';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/**
 * The feed process, in five numbers. Rendered only when `/metrics` answers, so
 * a dashboard running on the offline demo generator simply omits it.
 */
@Component({
  selector: 'app-feed-health',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (metrics(); as m) {
      <dl class="health">
        <div class="health__item">
          <dt>Uptime</dt>
          <dd>{{ uptime() }}</dd>
        </div>
        <div class="health__item">
          <dt>Ticks polled</dt>
          <dd>{{ m.polls }}</dd>
        </div>
        <div class="health__item">
          <dt>Frames sent</dt>
          <dd>{{ m.framesSent }}</dd>
        </div>
        <div class="health__item">
          <dt>Subscribers</dt>
          <dd>{{ m.clients }}</dd>
        </div>
        <div class="health__item" [class.health__item--bad]="m.failures > 0">
          <dt>Poll failures</dt>
          <dd>{{ m.failures }}</dd>
        </div>
        @if (m.lastError) {
          <div class="health__item health__item--bad health__item--wide">
            <dt>Last error</dt>
            <dd>{{ m.lastError }}</dd>
          </div>
        }
      </dl>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .health {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 2.5rem;
      margin: 0;
      padding: 0.85rem 1.1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-sunken);
    }

    .health__item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .health__item dt {
      font-size: 0.62rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-faint);
      white-space: nowrap;
    }

    .health__item dd {
      margin: 0;
      font-family: var(--font-numeric);
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
      color: var(--text);
    }

    .health__item--bad dd {
      color: var(--down);
    }

    .health__item--wide {
      flex: 1 1 100%;
    }

    .health__item--wide dd {
      font-size: 0.75rem;
      overflow-wrap: anywhere;
    }
  `,
})
export class FeedHealthComponent {
  readonly metrics = input<FeedMetrics | null>(null);

  protected readonly uptime = computed(() => {
    const seconds = this.metrics()?.uptimeSeconds ?? 0;
    if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`;
    if (seconds < SECONDS_PER_HOUR) {
      return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m ${seconds % SECONDS_PER_MINUTE}s`;
    }
    const hours = Math.floor(seconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    return `${hours}h ${minutes}m`;
  });
}
