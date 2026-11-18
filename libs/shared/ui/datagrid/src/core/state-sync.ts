/**
 * Keeps the arrangement, the `state` model and the persistence adapter in step
 * (§14.2, §14.3).
 *
 * All the bookkeeping the two-way sync needs lives here: the last state handed
 * to the host, the flag that stops the grid reading its own write back, the
 * origin of the change in flight, the settle timer and the id already restored.
 * Every one of them is a guard against the same class of bug — two sides
 * writing to each other — and they are only correct read together.
 */
import { isDevMode, signal, type Signal } from '@angular/core';
import { STATE_CHANGE_DELAY } from '../datagrid.constants';
import { gridStatesEqual } from './state';
import type { ChangeOrigin } from './types/event.types';
import type { GridState } from './types/state.types';
import type { GridStateSyncDeps } from './state-sync.types';

export class GridStateSync {
  /** The state as last handed to the host, and the baseline every write diffs against. */
  private lastReported: GridState | null = null;
  private seeded = false;
  /** True while the grid writes `state`, so its own write is not read back as a host's. */
  private writing = false;
  /** Where the change now in flight came from. Reset to `'user'` after each read. */
  private origin: ChangeOrigin = 'user';
  private pendingOrigin: ChangeOrigin = 'user';
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The persistence id already restored, so a re-render does not restore twice. */
  private restoredKey: string | null = null;
  private readonly restoringState = signal(false);

  constructor(private readonly deps: GridStateSyncDeps) {}

  /** Holds the first query while a saved arrangement is still being loaded (§14.2). */
  get restoring(): Signal<boolean> {
    return this.restoringState.asReadonly();
  }

  /** Records where the change now being applied came from. */
  markOrigin(origin: ChangeOrigin): void {
    this.origin = origin;
  }

  /**
   * Loads and applies the saved arrangement, once per persistence id.
   *
   * A lost arrangement is the whole of the damage: the grid still renders, with
   * the arrangement its configuration declares.
   */
  async restore(): Promise<void> {
    const adapter = this.deps.adapter();
    const id = this.deps.stateKey();
    if (adapter == null || id == null || this.restoredKey === id) {
      return;
    }
    this.restoredKey = id;
    this.restoringState.set(true);
    try {
      const saved = await adapter.load(id);
      if (this.deps.isDestroyed()) {
        return;
      }
      if (saved != null) {
        this.deps.apply(saved, 'programmatic');
      }
    } catch (cause) {
      if (isDevMode()) {
        console.warn('datagrid: could not load the saved arrangement.', cause);
      }
    } finally {
      this.restoringState.set(false);
    }
  }

  /**
   * Reports the arrangement once it settles.
   *
   * Debounced because a resize drag writes a width per frame, and §20 forbids
   * a burst of intermediate events from one action. The latest origin wins: a
   * programmatic apply the user then adjusts is the user's change.
   */
  report(state: GridState): void {
    const origin = this.origin;
    this.origin = 'user';
    if (!this.seeded) {
      this.seeded = true;
      this.lastReported = state;
      return;
    }
    if (this.lastReported != null && gridStatesEqual(state, this.lastReported)) {
      return;
    }
    this.lastReported = state;
    this.writing = true;
    this.deps.publish(state);
    this.writing = false;
    this.pendingOrigin = origin;
    if (this.timer != null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, STATE_CHANGE_DELAY);
  }

  /**
   * Applies a state the host wrote to `[state]`.
   *
   * The grid's own write-back comes through the writing flag and through the
   * equality test, so the two sides converge instead of ringing — the trap a
   * `model()` mirroring store state always hits.
   */
  acceptHostState(incoming: GridState | null): void {
    if (incoming == null || this.writing) {
      return;
    }
    if (this.lastReported != null && gridStatesEqual(incoming, this.lastReported)) {
      return;
    }
    this.deps.apply(incoming, 'programmatic');
  }

  /** Drops the saved arrangement, so a reset is not undone on the next visit. */
  forget(): void {
    const adapter = this.deps.adapter();
    const id = this.deps.stateKey();
    if (adapter?.clear == null || id == null) {
      return;
    }
    try {
      void adapter.clear(id);
    } catch (cause) {
      if (isDevMode()) {
        console.warn('datagrid: could not clear the saved arrangement.', cause);
      }
    }
  }

  /** Saves a change still waiting on the settle timer. For the grid's teardown. */
  flushPending(): void {
    if (this.timer == null) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = null;
    this.persist(this.deps.snapshot());
  }

  private flush(): void {
    if (this.deps.isDestroyed()) {
      return;
    }
    const state = this.deps.snapshot();
    this.deps.settled(state, this.pendingOrigin);
    this.persist(state);
  }

  /**
   * Saves the arrangement. Withholding `stateChange` stops the write rather
   * than the apply: a read-only grid still restores what it was given, it
   * simply does not record what the reader did with it.
   */
  private persist(state: GridState): void {
    const adapter = this.deps.adapter();
    const id = this.deps.stateKey();
    if (adapter == null || id == null || !this.deps.canPersist()) {
      return;
    }
    try {
      void adapter.save(id, state);
    } catch (cause) {
      if (isDevMode()) {
        console.warn('datagrid: could not save the arrangement.', cause);
      }
    }
  }
}
