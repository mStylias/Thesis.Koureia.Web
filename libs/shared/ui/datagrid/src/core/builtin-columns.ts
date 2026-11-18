/**
 * Columns the grid contributes itself.
 *
 * They are ordinary {@link ColumnDef}s so the layout, the sticky insets and
 * the ARIA indices treat them exactly like host columns. Their ids carry a
 * namespace a host id cannot reach, and every feature that would let the user
 * move, hide or sort them is switched off.
 */
import type { ColumnDef } from './types/column.types';

/** Id of the selection checkbox column. */
export const SELECTION_COLUMN_ID = 'lib-datagrid:selection';

/** Id of the row number column. */
export const ROW_NUMBER_COLUMN_ID = 'lib-datagrid:row-number';

/** Id of the row detail expander column. */
export const DETAIL_COLUMN_ID = 'lib-datagrid:detail';

/** True for a column the grid contributed rather than the host. */
export function isBuiltInColumn(id: string): boolean {
  return id === SELECTION_COLUMN_ID || id === ROW_NUMBER_COLUMN_ID || id === DETAIL_COLUMN_ID;
}

const LOCKED: ColumnDef['allow'] = {
  sorting: false,
  filtering: false,
  headerFiltering: false,
  rowFiltering: false,
  grouping: false,
  reordering: false,
  resizing: false,
  hiding: false,
  editing: false,
  exporting: false,
};

export function selectionColumn<TRow>(width: number): ColumnDef<TRow> {
  return {
    id: SELECTION_COLUMN_ID,
    width,
    minWidth: width,
    maxWidth: width,
    pinned: 'start',
    allow: LOCKED,
  };
}

export function rowNumberColumn<TRow>(width: number): ColumnDef<TRow> {
  return {
    id: ROW_NUMBER_COLUMN_ID,
    width,
    minWidth: width,
    // Fixed at both ends: `fitColumns` must spend the container surplus on the
    // data columns, and the user cannot resize this one back.
    maxWidth: width,
    pinned: 'start',
    allow: LOCKED,
  };
}

export function detailColumn<TRow>(width: number): ColumnDef<TRow> {
  return {
    id: DETAIL_COLUMN_ID,
    width,
    minWidth: width,
    maxWidth: width,
    pinned: 'start',
    allow: LOCKED,
  };
}
