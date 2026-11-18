import { Component, computed, input } from '@angular/core';

import {
  CHART_SKELETON_COLUMNS,
  CHART_SKELETON_COUNTS,
  CHART_SKELETON_RULES,
  CHART_SKELETON_WAVE,
  optionalNumber,
  skeletonBarHeights,
  skeletonCount,
  skeletonRing,
  skeletonRows,
  skeletonTicks,
} from './chart-skeleton-shape';
import type { ChartSkeletonKind } from './chart-skeleton.types';

/**
 * A loading placeholder shaped like the chart that replaces it: the axes, bars, ring or cells
 * of that kind, in faint surface tones, with a slow pulse. Give it the `height` the chart gets,
 * so nothing moves when the chart arrives.
 *
 * ```ts
 * import { ChartSkeleton } from '@ui/chart';
 * ```
 *
 * ```html
 * @if (loading()) {
 *   <lib-chart-skeleton kind="bars" [count]="7" height="18rem" />
 * } @else {
 *   <lib-chart [option]="option()" ariaLabel="Appointments per weekday" height="18rem" />
 * }
 * ```
 *
 * It is hidden from assistive technology. Say "loading" on the region that holds it, with
 * `aria-busy`.
 */
@Component({
  selector: 'lib-chart-skeleton',
  templateUrl: './chart-skeleton.html',
  styleUrl: './chart-skeleton.scss',
  host: {
    'aria-hidden': 'true',
    '[attr.data-kind]': 'kind()',
    '[style.height]': 'height()',
  },
})
export class ChartSkeleton {
  /** The chart this placeholder stands in for. It sets the shape. */
  readonly kind = input.required<ChartSkeletonKind>();

  /** The height of the host, as a CSS length. Give the value the real `lib-chart` gets. */
  readonly height = input('18rem');

  /**
   * The bars of `bars`, the rows of `bars-horizontal` and `heatmap`, or the x-axis stubs of
   * `line`. A whole number from 1 to 60. Left out, it is 7, 5, 7 and 6. `donut`, `treemap` and
   * `sparkline` ignore it.
   */
  readonly count = input<number | undefined, unknown>(undefined, { transform: optionalNumber });

  /** The columns of a `heatmap`. A whole number from 1 to 60. */
  readonly columns = input(CHART_SKELETON_COLUMNS, {
    transform: (value: unknown) => skeletonCount(optionalNumber(value), CHART_SKELETON_COLUMNS),
  });

  protected readonly rules = Array.from({ length: CHART_SKELETON_RULES }, (_, index) => index);
  protected readonly wave = CHART_SKELETON_WAVE;
  protected readonly ring = skeletonRing();
  protected readonly blocks = ['a', 'b', 'c', 'd', 'e'] as const;

  protected readonly size = computed(() =>
    skeletonCount(this.count(), CHART_SKELETON_COUNTS[this.kind()]),
  );
  protected readonly barHeights = computed(() => skeletonBarHeights(this.size()));
  protected readonly rows = computed(() => skeletonRows(this.size()));
  protected readonly ticks = computed(() => skeletonTicks(this.size()));
  protected readonly heatRows = computed(() =>
    Array.from({ length: this.size() }, (_, index) => index),
  );
  protected readonly heatTicks = computed(() => skeletonTicks(this.columns()));
}
