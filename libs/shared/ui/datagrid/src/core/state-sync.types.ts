import type { ChangeOrigin } from './types/event.types';
import type { GridState } from './types/state.types';
import type { GridStatePersistence } from './state-persistence.types';

/**
 * What the arrangement's two-way sync reads and does.
 *
 * The shell keeps the effects — the reactive wiring is where the ordering
 * traps live and belongs in one readable place — and hands the sync only the
 * reads and writes each of them needs.
 */
export interface GridStateSyncDeps {
  /** The bound adapter, or the application's. `null` when nothing persists. */
  readonly adapter: () => GridStatePersistence | null;
  readonly stateKey: () => string | null;
  /** Whether `stateChange` is granted, which gates the write, not the apply. */
  readonly canPersist: () => boolean;
  readonly isDestroyed: () => boolean;
  /** The arrangement as it stands, volatile values excluded. */
  readonly snapshot: () => GridState;
  readonly apply: (state: GridState, origin: ChangeOrigin) => void;
  /** Writes the two-way `state` model. */
  readonly publish: (state: GridState) => void;
  /** Reports the settled change to the host. */
  readonly settled: (state: GridState, origin: ChangeOrigin) => void;
}
