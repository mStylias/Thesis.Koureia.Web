import type { GroupNode } from './group-nodes.types';
import type { GridKey } from '../types/key.types';

/** What one entry of the body draws. */
export type GridBodyItemKind = 'data' | 'group' | 'groupFooter' | 'detail';

/** A data row. */
export interface GridDataItem<TRow = unknown> {
  kind: 'data';
  key: GridKey;
  row: TRow;
  /** Absolute index in the dataset, for the row number column and ARIA. */
  dataIndex: number;
  /** Group nesting depth the row sits at. `0` when the grid is not grouped. */
  level: number;
  height: number;
}

/** A group header row. */
export interface GridGroupItem<TRow = unknown> {
  kind: 'group';
  node: GroupNode<TRow>;
  expanded: boolean;
  level: number;
  height: number;
}

/** A group footer row, carrying the group's aggregates under their columns. */
export interface GridGroupFooterItem<TRow = unknown> {
  kind: 'groupFooter';
  node: GroupNode<TRow>;
  level: number;
  height: number;
}

/** The expanded detail region of one row. */
export interface GridDetailItem<TRow = unknown> {
  kind: 'detail';
  key: GridKey;
  row: TRow;
  level: number;
  height: number;
}

/** One entry of the flattened body. */
export type GridBodyItem<TRow = unknown> =
  | GridDataItem<TRow>
  | GridGroupItem<TRow>
  | GridGroupFooterItem<TRow>
  | GridDetailItem<TRow>;

/** Heights of each entry kind, in pixels. */
export interface BodyItemHeights {
  data: number;
  group: number;
  groupFooter: number;
  detail: number;
}

/** What flattening needs to know. */
export interface BodyItemOptions<TRow = unknown> {
  keyOf: (row: TRow) => GridKey;
  isGroupExpanded: (path: readonly unknown[]) => boolean;
  isRowExpanded: (key: GridKey) => boolean;
  /** Whether a group emits a footer row after its contents. */
  groupFooters: boolean;
  heights: BodyItemHeights;
  /** Absolute index of the first data row, so paged rows number correctly. */
  startIndex: number;
}
