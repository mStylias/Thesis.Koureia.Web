import type { ChartSkeletonKind } from '@ui/chart';

/**
 * What a chart card shows: the skeleton before the first response, the failure with its retry,
 * the empty message, or the chart.
 */
export type ChartCardState = 'skeleton' | 'failed' | 'empty' | 'ready';

/** The loading placeholder of a chart card. It draws the shape of the content that replaces it. */
export interface ChartCardSkeleton {
  /** The kind of `lib-chart-skeleton`, or `table` for the rows of a table. */
  readonly kind: ChartSkeletonKind | 'table';
  /** The bars, rows or x-axis stubs of `lib-chart-skeleton`. The body rows of a `table`. */
  readonly count?: number;
  /** The legend entries of the loaded chart. Below 2, the card draws no legend. */
  readonly legend?: number;
}
