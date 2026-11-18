import type { GridColumnState, GridState } from '@ui/datagrid';

import { COLUMN } from './appointments.columns';

/**
 * The arrangement of "this customer's appointments", built from the one on screen.
 *
 * The columns keep their order, widths and visibility. Every filter goes, the upcoming one
 * included, so past appointments show. What is left is the customer, latest first.
 */
export function customerViewState(current: GridState, customerId: string): GridState {
  return {
    ...current,
    filter: null,
    search: null,
    columns: current.columns.map((column) => {
      const kept = withoutQuery(column);
      if (column.id === COLUMN.customer) {
        return { ...kept, headerFilter: { field: 'customerId', op: 'eq', value: customerId } };
      }
      if (column.id === COLUMN.startsAt) {
        return { ...kept, sort: { order: 'desc', index: 0 } };
      }
      return kept;
    }),
  };
}

/** A column's arrangement without its sort and its three filter slots. */
function withoutQuery(column: GridColumnState): GridColumnState {
  return {
    id: column.id,
    ...(column.visible === undefined ? {} : { visible: column.visible }),
    ...(column.visibleIndex === undefined ? {} : { visibleIndex: column.visibleIndex }),
    ...(column.width === undefined ? {} : { width: column.width }),
    ...(column.pinned === undefined ? {} : { pinned: column.pinned }),
    ...(column.group === undefined ? {} : { group: column.group }),
  };
}
