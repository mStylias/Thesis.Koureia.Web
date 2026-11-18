import type { ColumnStore } from './column.store';
import type { QueryStore } from './query.store';
import type { GridVolatileState } from './types/state.types';

/**
 * Reads and writes the values that are not in a store of their own — the
 * scroll offsets are DOM, the focused cell is a view concern. The shell
 * supplies it so this module keeps its one dependency on the two stores.
 */
export interface GridVolatileAccess {
  read(): GridVolatileState;
  write(state: GridVolatileState): void;
}

/** The stores one grid state spans. */
export interface GridStateStores<TRow = unknown> {
  columns: ColumnStore<TRow>;
  query: QueryStore;
  /** Absent from a headless use, where there is no viewport and no focus. */
  volatile?: GridVolatileAccess;
}
