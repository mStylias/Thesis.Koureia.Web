import type { FilterOperator } from '../types/filter.types';

/** One column's filter, as the filter row holds it. */
export interface ColumnFilterValue {
  op: FilterOperator;
  /** Absent for a null test, a `[min, max]` tuple for `between`. */
  value?: unknown;
}
