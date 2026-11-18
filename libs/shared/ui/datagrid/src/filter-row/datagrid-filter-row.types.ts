import type { FilterOperator } from '../core/types/filter.types';

/** What a filter row cell reports when its editor changes. */
export interface DatagridFilterChange {
  columnId: string;
  op: FilterOperator;
  value: unknown;
  valueEnd: unknown;
}
