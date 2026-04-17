import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Trend } from '../../models/stock-quote';

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 60;
/** Keeps a flat series off the very edge of the box. */
const PADDING = 2;

/**
 * A price series as a single SVG path, sized in viewBox units and stretched by
 * CSS so it stays sharp at any card width. Decorative by design: the numbers it
 * summarises are all printed next to it, so it carries `aria-hidden`.
 */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points().length > 1) {
      <svg
        class="spark"
        [attr.viewBox]="'0 0 ' + VIEW_WIDTH + ' ' + VIEW_HEIGHT"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path class="spark__fill" [attr.d]="areaPath()" />
        <path class="spark__line" [attr.d]="linePath()" />
      </svg>
    } @else {
      <div class="spark spark--empty" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .spark {
      display: block;
      width: 100%;
      height: 76px;
    }

    .spark--empty {
      border-bottom: 1px dashed var(--border);
    }

    .spark__line {
      fill: none;
      stroke: var(--spark-colour, var(--flat));
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }

    .spark__fill {
      fill: var(--spark-colour, var(--flat));
      opacity: 0.12;
      stroke: none;
    }
  `,
})
export class SparklineComponent {
  readonly values = input<readonly number[]>([]);
  readonly trend = input<Trend>('flat');

  protected readonly VIEW_WIDTH = VIEW_WIDTH;
  protected readonly VIEW_HEIGHT = VIEW_HEIGHT;

  protected readonly points = computed(() => {
    const values = this.values();
    if (values.length < 2) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    // A perfectly flat series has no range to normalise against; draw it centred.
    const range = max - min || 1;
    const usable = VIEW_HEIGHT - PADDING * 2;
    return values.map((value, index) => ({
      x: (index / (values.length - 1)) * VIEW_WIDTH,
      y: PADDING + (1 - (value - min) / range) * usable,
    }));
  });

  protected readonly linePath = computed(() =>
    this.points()
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' '),
  );

  protected readonly areaPath = computed(() => {
    const points = this.points();
    if (points.length < 2) return '';
    const last = points[points.length - 1];
    return `${this.linePath()} L${last.x.toFixed(2)},${VIEW_HEIGHT} L0,${VIEW_HEIGHT} Z`;
  });
}
