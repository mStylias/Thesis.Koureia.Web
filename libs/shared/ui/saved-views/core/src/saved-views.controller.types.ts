import type { SavedViewsStorage } from './saved-views.types';

/**
 * What the views controller reads and does.
 *
 * Getters and callbacks only, never a store: a controller holding the host's
 * store could reach the whole of it, where one holding `apply` cannot. It is
 * also what makes the field-initializer order stop mattering — the controller
 * is constructed before some of the members it reads are declared.
 */
export interface SavedViewsControllerDeps<TState> {
  /** Names the document. `null` turns the strip off. */
  readonly key: () => string | null;
  readonly storage: () => SavedViewsStorage | null;
  /** The host's arrangement as it stands, volatile values excluded. */
  readonly state: () => TState;
  /** Applies a view's state. One call, one query. */
  readonly apply: (state: TState) => void;
  readonly isDestroyed: () => boolean;
  /**
   * Whether a stored value is a state this host can apply.
   *
   * A view whose state fails this is dropped on load rather than applied half
   * way: the store carries documents for every host in the application, and
   * only the host knows its own shape.
   */
  readonly isState: (value: unknown) => value is TState;
  /**
   * Whether the host's state is the same arrangement as a saved view's state.
   *
   * Decides `dirty`, so it must ignore whatever the host treats as volatile —
   * a scroll position that counted as an unsaved change would ask to be saved
   * forever.
   */
  readonly statesEqual: (current: TState, saved: TState) => boolean;
  /**
   * Puts the host back to its declared arrangement. Called when a temporary view closes and no
   * stored view is left to select. Absent leaves the host as it is.
   */
  readonly reset?: () => void;
}
