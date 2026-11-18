import type { GridApi } from './types/api.types';
import type { UNIMPLEMENTED, MUTATING, ASYNC } from './grid-api';

/**
 * The {@link GridApi} methods the shipped milestones implement. The host —
 * the grid shell — supplies exactly these; the factory fills in the rest.
 */
export type ImplementedApiMethod =
  | 'reload'
  | 'reset'
  | 'applyQuery'
  | 'getQuery'
  | 'getRows'
  | 'getRow'
  | 'getTotalCount'
  | 'refreshRow'
  | 'applyTransaction'
  | 'getColumns'
  | 'getVisibleColumns'
  | 'setColumnVisible'
  | 'setColumnWidth'
  | 'moveColumn'
  | 'pinColumn'
  | 'autoSizeColumns'
  | 'getState'
  | 'setState'
  | 'resetState'
  | 'openTemporaryView'
  | 'closeTemporaryView'
  | 'isDirty'
  | 'getFilter'
  | 'setFilter'
  | 'getColumnFilter'
  | 'setColumnFilter'
  | 'getHeaderFilter'
  | 'setHeaderFilter'
  | 'clearHeaderFilter'
  | 'clearColumnFilter'
  | 'clearFilters'
  | 'getSearch'
  | 'setSearch'
  | 'getSort'
  | 'setSort'
  | 'getGroup'
  | 'setGroup'
  | 'expandGroup'
  | 'collapseGroup'
  | 'expandAllGroups'
  | 'collapseAllGroups'
  | 'expandRow'
  | 'collapseRow'
  | 'getExpandedKeys'
  | 'getSelectedKeys'
  | 'getSelectedRows'
  | 'setSelectedKeys'
  | 'clearSelection'
  | 'selectAllMatching'
  | 'getSelection'
  | 'focusCell'
  | 'getFocusedCell'
  | 'scrollToRow'
  | 'scrollToColumn'
  | 'getScrollPosition'
  | 'setScrollPosition'
  | 'export'
  | 'copyToClipboard'
  | 'print'
  | 'repaint';

/**
 * What the grid shell provides. Every member must be bound to the shell —
 * the factory stores the functions, it does not call them through the host.
 */
export type GridApiHost<TRow = unknown> = Pick<GridApi<TRow>, ImplementedApiMethod>;

export type UnimplementedApiMethod = (typeof UNIMPLEMENTED)[number];

export type AsyncApiMethod = (typeof ASYNC)[number];

export type MutatingApiMethod = (typeof MUTATING)[number];
