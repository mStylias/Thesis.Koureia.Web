import type { FilterNode } from '../core/types/filter.types';
import type { DatagridHeaderFilterEntry } from '../datagrid.types';

/** One header filter entry, with the sub-tree checking it contributes. */
export interface HeaderFilterEntry extends DatagridHeaderFilterEntry {
  node: FilterNode;
  children?: readonly HeaderFilterEntry[];
}
