/**
 * Named views, as a collaborator of a host that has an arrangement to save.
 *
 * It owns the list, the selection, the inline editor and every write to the
 * store. The strip renders it and calls into it; the host reaches it through
 * {@link load}, which answers the state its first render should start from.
 */
import { computed, isDevMode, signal, type Signal } from '@angular/core';
import {
  addView,
  createViewId,
  duplicateView,
  moveView,
  normalizeViewName,
  removeView,
  uniqueViewName,
  savedViewsDocument,
  setDefaultView,
  updateView,
} from './saved-view-operations';
import type { SavedViewsControllerDeps } from './saved-views.controller.types';
import type {
  SavedView,
  SavedViewEditor,
  SavedViewsLoadOptions,
  SavedViewsStatus,
  TemporarySavedView,
} from './saved-views.types';

export class SavedViewsController<TState> {
  private readonly viewList = signal<readonly SavedView<TState>[]>([]);
  private readonly selection = signal<string | null>(null);
  private readonly editorState = signal<SavedViewEditor | null>(null);
  private readonly statusState = signal<SavedViewsStatus>('idle');
  private readonly loaded = signal(false);
  private readonly temporaryView = signal<TemporarySavedView<TState> | null>(null);
  /** The order a drag started from, so a failed write does not keep its swaps. */
  private dragOrigin: readonly SavedView<TState>[] | null = null;

  constructor(private readonly deps: SavedViewsControllerDeps<TState>) {}

  /** The views, in the order they are drawn. The first is the default. */
  get views(): Signal<readonly SavedView<TState>[]> {
    return this.viewList.asReadonly();
  }

  /** The view made for this visit, drawn after the stored ones. See {@link TemporarySavedView}. */
  get temporary(): Signal<TemporarySavedView<TState> | null> {
    return this.temporaryView.asReadonly();
  }

  /** The selected view's id, or `null` while none is applied. */
  get selectedId(): Signal<string | null> {
    return this.selection.asReadonly();
  }

  get editor(): Signal<SavedViewEditor | null> {
    return this.editorState.asReadonly();
  }

  get status(): Signal<SavedViewsStatus> {
    return this.statusState.asReadonly();
  }

  /** True once the document has been read, so an empty strip can say which empty it is. */
  get ready(): Signal<boolean> {
    return this.loaded.asReadonly();
  }

  readonly selected = computed<SavedView<TState> | null>(() => {
    const id = this.selection();
    const temporary = this.temporaryView();
    if (temporary?.id === id) {
      return temporary;
    }
    return this.viewList().find((view) => view.id === id) ?? null;
  });

  /** True while the temporary view is the one on screen. Nothing may store it. */
  readonly temporarySelected = computed(() => {
    const id = this.selection();
    return id != null && this.temporaryView()?.id === id;
  });

  /**
   * Whether the host has moved away from the selected view's saved state.
   *
   * `statesEqual` is the host's, so it ignores what the host treats as
   * volatile. Only the *selected* view can be dirty: nothing else is on screen
   * to have moved.
   */
  readonly dirty = computed(() => {
    const view = this.selected();
    // Held while the editor is open: a name being typed is not an arrangement
    // change, and the save button of the editor is the only one that applies.
    return (
      view != null &&
      this.editorState() == null &&
      !this.deps.statesEqual(this.deps.state(), view.state)
    );
  });

  /**
   * Reads the document and answers with the state the host should start in.
   *
   * The host calls it before its first query: the content of a screen is a
   * consequence of its view, so it cannot go out first. A failure is reported
   * and swallowed: the views are lost for this visit, which is the whole of
   * the damage — the host still renders, arranged the way its configuration
   * declares.
   */
  async load(key: string, options: SavedViewsLoadOptions<TState> = {}): Promise<TState | null> {
    const requested = options.temporary ?? null;
    // A promise is awaited beside the document, not ahead of it. A rejection opens the default.
    const pending = isPromiseLike(requested)
      ? Promise.resolve(requested).then(
          (view) => view,
          () => null,
        )
      : null;
    let temporary = isPromiseLike(requested) ? null : requested;
    this.temporaryView.set(temporary);
    const storage = this.deps.storage();
    if (storage == null) {
      if (isDevMode()) {
        console.warn(
          'saved-views: views are on but nothing stores them. Call provideSavedViewsStorage().',
        );
      }
      if (pending !== null) {
        temporary = await pending;
        this.temporaryView.set(temporary);
      }
      this.loaded.set(true);
      this.selection.set(temporary?.id ?? null);
      return temporary?.state ?? null;
    }
    this.statusState.set('loading');
    try {
      const [document, awaited] =
        pending === null
          ? [await storage.load(key), temporary]
          : await Promise.all([storage.load(key), pending]);
      if (this.deps.isDestroyed()) {
        return null;
      }
      if (pending !== null) {
        temporary = awaited;
        this.temporaryView.set(temporary);
      }
      // A view whose state this host cannot read is dropped, not applied half
      // way. The store carries every host's documents and knows none of them.
      const views = (document?.views ?? []).filter((view): view is SavedView<TState> =>
        this.deps.isState(view.state),
      );
      this.viewList.set(views);
      // The first view is the default, and the default is what a fresh load
      // applies. A selection is deliberately not persisted: carrying one
      // person's last-used view across a reload is a different feature.
      // A temporary view wins over the default, so the host's first query is the temporary
      // view's and the default is never applied on the way.
      const first = temporary ?? views.at(0);
      this.selection.set(first?.id ?? null);
      this.statusState.set('idle');
      return first?.state ?? null;
    } catch (cause) {
      if (isDevMode()) {
        console.warn('saved-views: could not load the saved views.', cause);
      }
      if (pending !== null) {
        temporary = await pending;
        this.temporaryView.set(temporary);
      }
      this.statusState.set('error');
      this.selection.set(temporary?.id ?? null);
      return temporary?.state ?? null;
    } finally {
      this.loaded.set(true);
    }
  }

  /** Selects a view and applies its state. Unsaved changes to the previous one are dropped. */
  select(id: string): void {
    if (id === this.selection()) {
      return;
    }
    const temporary = this.temporaryView();
    const view =
      temporary?.id === id ? temporary : this.viewList().find((entry) => entry.id === id);
    if (view === undefined) {
      return;
    }
    const current = this.selection();
    if (current != null && temporary?.id === current) {
      temporary.onLeave?.();
    }
    this.editorState.set(null);
    this.selection.set(id);
    this.deps.apply(view.state);
  }

  /**
   * Shows a temporary view, selects it and applies it: one `apply`, so one query. A second
   * call replaces the first temporary view.
   */
  openTemporary(view: TemporarySavedView<TState>): void {
    this.editorState.set(null);
    this.temporaryView.set(view);
    this.selection.set(view.id);
    this.deps.apply(view.state);
  }

  /**
   * Removes the temporary view. When it was on screen, the default view is applied, or the
   * host's declared arrangement when no view is stored.
   */
  closeTemporary(): void {
    const temporary = this.temporaryView();
    if (temporary == null) {
      return;
    }
    this.temporaryView.set(null);
    if (this.selection() !== temporary.id) {
      return;
    }
    temporary.onLeave?.();
    const first = this.viewList().at(0);
    this.selection.set(first?.id ?? null);
    if (first != null) {
      this.deps.apply(first.state);
    } else {
      this.deps.reset?.();
    }
  }

  /** Whether `id` names the temporary view, which no list operation may touch. */
  private isTemporary(id: string): boolean {
    return this.temporaryView()?.id === id;
  }

  /** Opens the editor on a new, empty name. */
  beginCreate(): void {
    this.editorState.set({ mode: 'create', id: null, name: '' });
  }

  /** Opens the editor on an existing view's name. */
  beginRename(id: string): void {
    const view = this.viewList().find((entry) => entry.id === id);
    if (view === undefined) {
      return;
    }
    this.editorState.set({ mode: 'rename', id, name: view.name });
  }

  setEditorName(name: string): void {
    const editor = this.editorState();
    if (editor != null) {
      this.editorState.set({ ...editor, name });
    }
  }

  /** Abandons the edit. The host's arrangement is untouched — only the name was in flight. */
  cancelEditor(): void {
    this.editorState.set(null);
  }

  /**
   * Applies the editor.
   *
   * Creating stores the arrangement on screen under the typed name and selects
   * it. Renaming stores the name — and, when the renamed view is the one on
   * screen, the arrangement with it, so one press settles both. Renaming a
   * view that is *not* selected writes the name alone: the arrangement on
   * screen belongs to a different view, and copying it in would destroy this
   * one.
   */
  commitEditor(): void {
    const editor = this.editorState();
    if (editor == null) {
      return;
    }
    const name = normalizeViewName(editor.name);
    if (name.length === 0) {
      return;
    }
    const state = this.deps.state();
    if (editor.mode === 'create') {
      const view: SavedView<TState> = { id: createViewId(), name, state };
      this.editorState.set(null);
      void this.commit(addView(this.viewList(), view), { selection: view.id });
      return;
    }
    const id = editor.id;
    if (id == null) {
      return;
    }
    const changes = id === this.selection() ? { name, state } : { name };
    this.editorState.set(null);
    void this.commit(updateView(this.viewList(), id, changes));
  }

  /** Stores the arrangement on screen into the selected view. */
  saveChanges(): void {
    const view = this.selected();
    if (view == null || this.isTemporary(view.id)) {
      return;
    }
    void this.commit(updateView(this.viewList(), view.id, { state: this.deps.state() }));
  }

  /** Puts the host back to the selected view's saved state. */
  revertChanges(): void {
    const view = this.selected();
    if (view != null) {
      this.deps.apply(view.state);
    }
  }

  /** A copy beside the original, selected so the user is working on the copy. */
  duplicate(id: string): void {
    const temporary = this.temporaryView();
    if (temporary?.id === id) {
      // A stored copy of the arrangement on screen, at the end of the list. Never at the
      // front, which would make it the default without the reader asking for that.
      const copy: SavedView<TState> = {
        id: createViewId(),
        name: uniqueViewName(this.viewList(), temporary.name),
        state: this.deps.state(),
      };
      void this.commit(addView(this.viewList(), copy), { selection: copy.id });
      temporary.onLeave?.();
      return;
    }
    const next = duplicateView(this.viewList(), id);
    const copy = next.at(next.findIndex((view) => view.id === id) + 1);
    void this.commit(next, copy == null ? {} : { selection: copy.id });
  }

  /** Moves a view to the front, which is what makes it the one a fresh load applies. */
  setDefault(id: string): void {
    if (this.isTemporary(id)) {
      return;
    }
    void this.commit(setDefaultView(this.viewList(), id));
  }

  /**
   * Removes a view. The caller has already confirmed.
   *
   * Removing the selected view falls through to whatever is first, so the
   * strip never shows a selection that is not there. Removing the last one
   * leaves the host exactly as it is: the arrangement on screen is still the
   * arrangement the user was reading.
   */
  remove(id: string): void {
    if (this.isTemporary(id)) {
      this.closeTemporary();
      return;
    }
    const next = removeView(this.viewList(), id);
    if (this.editorState()?.id === id) {
      this.editorState.set(null);
    }
    if (id !== this.selection()) {
      void this.commit(next);
      return;
    }
    const first = next.at(0);
    void this.commit(next, { selection: first?.id ?? null, apply: first?.state ?? null });
  }

  /** Reorders by drag or by `Ctrl`+arrow. The index is clamped, not refused. */
  move(id: string, toIndex: number): void {
    if (this.isTemporary(id)) {
      return;
    }
    void this.commit(moveView(this.viewList(), id, toIndex));
  }

  /**
   * Reorders without writing, for the live swap a drag performs per move.
   *
   * The order as it stood when the drag started is kept, because that is what
   * a failed write has to roll back to — by the time the drag ends the list
   * signal holds every intermediate swap.
   */
  previewMove(id: string, toIndex: number): void {
    if (this.isTemporary(id)) {
      return;
    }
    this.dragOrigin ??= this.viewList();
    this.viewList.set(moveView(this.viewList(), id, toIndex));
  }

  /** Writes the order the drag settled on. Called once, on release. */
  commitOrder(): void {
    const origin = this.dragOrigin;
    this.dragOrigin = null;
    void this.commit(this.viewList(), origin == null ? {} : { rollbackTo: origin });
  }

  /**
   * Applies a change on screen and writes it.
   *
   * Optimistic, and rolled back whole on a failure: every one of these runs
   * from a press, so the strip has to answer the press immediately, and a
   * write that did not land must not leave the user believing it did. The
   * rollback covers the selection and the applied state as well as the list —
   * a selection left pointing at a view that was rolled out of the list is the
   * same bug wearing a different hat.
   */
  private async commit(
    views: readonly SavedView<TState>[],
    options: {
      /** The selection this change brings, applied inside the snapshot. */
      selection?: string | null;
      /** A state to apply with it. `null` leaves the host as it is. */
      apply?: TState | null;
      /** The list to return to on a failure. Defaults to the list as it stands. */
      rollbackTo?: readonly SavedView<TState>[];
    } = {},
  ): Promise<void> {
    const previousViews = options.rollbackTo ?? this.viewList();
    const previousSelection = this.selection();
    this.viewList.set([...views]);
    if (options.selection !== undefined) {
      this.selection.set(options.selection);
    }
    if (options.apply != null) {
      this.deps.apply(options.apply);
    }
    const storage = this.deps.storage();
    const key = this.deps.key();
    if (storage == null || key == null) {
      return;
    }
    this.statusState.set('saving');
    try {
      await storage.save(key, savedViewsDocument(views));
      if (!this.deps.isDestroyed()) {
        this.statusState.set('idle');
      }
    } catch (cause) {
      if (isDevMode()) {
        console.warn('saved-views: could not save the views.', cause);
      }
      if (this.deps.isDestroyed()) {
        return;
      }
      this.viewList.set([...previousViews]);
      if (this.selection() !== previousSelection) {
        this.selection.set(previousSelection);
        const restored = previousViews.find((view) => view.id === previousSelection);
        if (restored != null) {
          this.deps.apply(restored.state);
        }
      }
      this.statusState.set('error');
    }
  }
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<PromiseLike<T>>).then === 'function'
  );
}
