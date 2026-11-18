import type { GridApi } from '@ui/datagrid';
import type { NOT_BACK_DAYS } from './not-back-filter';

/** A choice of the "not back for" filter, in days. */
export type NotBackDays = (typeof NOT_BACK_DAYS)[number];

/** The part of the grid API the quick filter reads and writes. */
export type NotBackGrid = Pick<
  GridApi,
  'getColumnFilter' | 'setColumnFilter' | 'clearColumnFilter'
>;
