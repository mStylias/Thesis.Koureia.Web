/** How one slice of a donut draws. */
export interface DonutSliceStyle {
  readonly color: string;
  readonly opacity: number;
}

/** The style of the slice for an axis item, by its key and its index in the set. */
export type DonutStyler = (key: string, index: number) => DonutSliceStyle;

/** The params ECharts gives an item tooltip or a pie label. */
export interface DonutParams {
  readonly name?: unknown;
  readonly value?: unknown;
  readonly percent?: unknown;
  readonly color?: unknown;
}
