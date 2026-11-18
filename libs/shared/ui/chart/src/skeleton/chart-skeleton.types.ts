/**
 * The chart that a `lib-chart-skeleton` stands in for. Each kind draws the shape of that chart.
 *
 * - `line`: gridlines, y-axis label stubs, one wave and x-axis label stubs.
 * - `bars`: vertical bars, gridlines and one x-axis label stub per bar.
 * - `bars-horizontal`: one row per bar, a label stub at the left and the value-axis stubs below.
 * - `donut`: one ring, the size of the dashboard donuts.
 * - `heatmap`: rows of cells, a label stub per row, the x-axis stubs and the ramp.
 * - `treemap`: five blocks in a fixed split.
 * - `sparkline`: a thin wave, no axes.
 */
export type ChartSkeletonKind =
  | 'line'
  | 'bars'
  | 'bars-horizontal'
  | 'donut'
  | 'heatmap'
  | 'treemap'
  | 'sparkline';

/** One row of a `bars-horizontal` skeleton. Both widths are percentages of their column. */
export interface ChartSkeletonRow {
  /** The width of the label stub, in percent of the label column. */
  readonly label: number;
  /** The width of the bar, in percent of the plot. */
  readonly bar: number;
}

/** The ring of a `donut` skeleton, in the units of a `0 0 100 100` view box. */
export interface ChartSkeletonRing {
  /** The radius of the stroke's center line. */
  readonly radius: number;
  /** The stroke width: the outer radius less the inner radius. */
  readonly width: number;
}
