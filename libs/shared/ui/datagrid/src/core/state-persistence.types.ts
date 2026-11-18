import type { GridState } from './types/state.types';

/**
 * Loads and saves one grid arrangement.
 *
 * Both methods may answer asynchronously. The grid never blocks first render
 * on a load, but it does hold the first data query until one settles, so no
 * request goes out with a projection or a filter the saved state is about to
 * replace.
 */
export interface GridStatePersistence {
  /** The saved state of `id`, or `null` when nothing was saved. */
  load(id: string): GridState | null | Promise<GridState | null>;
  save(id: string, state: GridState): void | Promise<void>;
  /** Forgets the saved state. Called when the grid resets its arrangement. */
  clear?(id: string): void | Promise<void>;
}
