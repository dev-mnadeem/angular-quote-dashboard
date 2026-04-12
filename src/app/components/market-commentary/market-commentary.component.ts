import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Commentary } from '../../core/commentary.service';

/**
 * The generated one-line read on the board. The provider that wrote it is named
 * on the strip, because a reader is entitled to know whether a sentence came
 * from a language model or from arithmetic.
 */
@Component({
  selector: 'app-market-commentary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (commentary(); as note) {
      <aside class="note">
        <span class="note__badge">Board read</span>
        <p class="note__text">{{ note.text }}</p>
        <span class="note__meta">
          {{ note.provider }} · {{ note.generatedAt | date: 'HH:mm:ss' }}
        </span>
      </aside>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .note {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.7rem 1rem;
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: var(--radius-sm);
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .note__badge {
      flex-shrink: 0;
      padding: 0.18rem 0.5rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 14%, transparent);
      color: var(--accent);
      font-size: 0.64rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .note__text {
      flex: 1 1 auto;
      margin: 0;
      font-size: 0.88rem;
      line-height: 1.45;
      color: var(--text);
    }

    .note__meta {
      flex-shrink: 0;
      font-size: 0.68rem;
      color: var(--text-faint);
      font-variant-numeric: tabular-nums;
    }

    @media (max-width: 720px) {
      .note {
        flex-wrap: wrap;
      }

      .note__text {
        flex-basis: 100%;
        order: 3;
      }
    }
  `,
})
export class MarketCommentaryComponent {
  readonly commentary = input<Commentary | null>(null);
}
