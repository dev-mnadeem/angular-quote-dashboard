import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FeedStatus } from '../../core/transport/quote-transport';

const LABELS: Record<FeedStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  retrying: 'Reconnecting',
  demo: 'Demo data',
  stopped: 'Stopped',
};

/**
 * Says out loud where the numbers are coming from. A dashboard whose feed has
 * quietly died looks exactly like one that is working, which is the single most
 * expensive failure mode a page like this has.
 */
@Component({
  selector: 'app-feed-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="pill" [attr.data-status]="status()" [title]="source()">
      <span class="pill__dot" aria-hidden="true"></span>
      <span class="pill__label">{{ label() }}</span>
      <span class="visually-hidden">. Source: {{ source() }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .pill {
      --dot: var(--text-faint);
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.65rem 0.25rem 0.55rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .pill[data-status='live'] {
      --dot: var(--up);
    }

    .pill[data-status='retrying'],
    .pill[data-status='connecting'] {
      --dot: #d98f24;
    }

    .pill[data-status='demo'] {
      --dot: var(--accent);
    }

    .pill[data-status='stopped'] {
      --dot: var(--down);
    }

    .pill__dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--dot);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--dot) 22%, transparent);
    }

    .pill[data-status='live'] .pill__dot {
      animation: pulse 2.4s ease-in-out infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.45;
      }
    }
  `,
})
export class FeedStatusComponent {
  readonly status = input.required<FeedStatus>();
  readonly source = input('');

  protected readonly label = computed(() => LABELS[this.status()]);
}
