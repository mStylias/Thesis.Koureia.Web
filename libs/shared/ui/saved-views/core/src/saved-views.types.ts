/** One saved preset, named by the user. Keyed on {@link id}, never on the name. */
export interface SavedView<TState> {
  /** Stable across sessions: it is stored, so it cannot be a per-session counter. */
  readonly id: string;
  readonly name: string;
  /** Everything the host arranged. The host decides what that is. */
  readonly state: TState;
}

/**
 * A view the host made for this visit, never stored.
 *
 * It is not a member of the view list. The first entry of that list is the default and every
 * list operation works on it, so a temporary view inside the list could be dragged to the
 * front, become the default, and be stored by the next write.
 */
export interface TemporarySavedView<TState> extends SavedView<TState> {
  /** Why it exists, for its indicator. Absent reads "Created automatically". */
  readonly description?: string;
  /**
   * Called once when it stops being the view on screen: another view is selected, it is
   * closed, or it is duplicated into a stored view. Not called when another temporary view
   * replaces it.
   */
  readonly onLeave?: () => void;
}

/** What {@link SavedViewsController.load} is told besides the key. */
export interface SavedViewsLoadOptions<TState> {
  /**
   * Selected instead of the default, and its state returned instead of the default's. A
   * promise is awaited beside the document. A rejected one opens the default.
   */
  readonly temporary?:
    | TemporarySavedView<TState>
    | PromiseLike<TemporarySavedView<TState> | null>
    | null;
}

/**
 * Every view of one host, plus their order, as one document.
 *
 * The order **is** the array order. Keeping it as a separate list would mean a
 * second round trip to read it and a way for the two to disagree; the first
 * entry is the default, which is also what makes "set as default" a move.
 */
export interface SavedViewsDocument<TState> {
  /** Schema version. See `SAVED_VIEWS_VERSION`. */
  readonly version: number;
  readonly views: readonly SavedView<TState>[];
}

/**
 * Loads and saves the whole document for one key.
 *
 * One document, so a create, a rename and a reorder are each a single write.
 * The library ships no implementation: `@features/saved-views` stores it in a
 * user resource, and any other backing store implements these two methods.
 *
 * Typed over `unknown` by default because a store is a transport: it carries
 * whatever the host saved and never reads it. The controller is the party that
 * knows the shape, and it checks every state it loads.
 */
export interface SavedViewsStorage<TState = unknown> {
  load(key: string): Promise<SavedViewsDocument<TState> | null>;
  save(key: string, document: SavedViewsDocument<TState>): Promise<void>;
}

/** What the strip is doing, which is the whole of its feedback. */
export type SavedViewsStatus = 'idle' | 'loading' | 'saving' | 'error';

/** Which name the inline editor is writing. */
export type SavedViewEditorMode = 'create' | 'rename';

/**
 * The inline name editor.
 *
 * `null` when the strip is only showing tabs. A view being created has no id
 * yet, which is what tells the two modes apart everywhere but the label.
 */
export interface SavedViewEditor {
  readonly mode: SavedViewEditorMode;
  /** The view being renamed. `null` while creating. */
  readonly id: string | null;
  readonly name: string;
}

/**
 * Which shape the strip draws.
 *
 * `strip` is a row of tabs, `compact` a listbox with the same rows. `auto`
 * picks by the headroom the host publishes through `SAVED_VIEWS_HEADROOM`, and
 * is the strip when no host publishes one.
 */
export type SavedViewsLayout = 'auto' | 'strip' | 'compact';
