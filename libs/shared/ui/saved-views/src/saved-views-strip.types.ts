import type { SavedView } from '@ui/saved-views/core';

/**
 * What the compact selectbox holds: a view's id, or the sentinel of the row
 * that opens the editor.
 *
 * A symbol rather than a reserved string — ids are generated, and a reserved
 * string is a rule someone has to keep. `SelectOption.value` is compared with
 * `===`, which a symbol satisfies and nothing else can collide with.
 */
export type SavedViewSelectValue = string | symbol;

/** One tab, with everything the template would otherwise recompute per binding. */
export interface SavedViewTab<TState> {
  readonly view: SavedView<TState>;
  readonly selected: boolean;
  /** The first view is the one a fresh load applies, so it is the default. */
  readonly isDefault: boolean;
  /** Only the selected view can have moved away from what was saved. */
  readonly dirty: boolean;
  /** The inline editor stands in this tab's place. */
  readonly editing: boolean;
  /** The view made for this visit. Never dragged, renamed, stored or made the default. */
  readonly temporary: boolean;
}

/** A reorder drag in flight. */
export interface SavedViewDrag {
  readonly id: string;
  readonly pointerId: number;
  /** Pointer x at the press, so the threshold is measured from where it started. */
  readonly startX: number;
  /** Pointer x as last seen, so a swap can re-anchor the tab without a new move. */
  readonly clientX: number;
  /** Where inside the tab the pointer took hold, so the tab does not jump to it. */
  readonly grabOffset: number;
  /** True once the pointer passed the threshold, which is what makes it a drag. */
  readonly moved: boolean;
  /**
   * The dragged tab's `offsetLeft` when the last swap was issued, or `null`
   * when none is in flight.
   *
   * The list signal changes on the swap but the DOM catches up a render later,
   * so a move arriving in between reads the old places and swaps the same pair
   * straight back. The drag waits for this number to stop describing the tab.
   */
  readonly pendingOffset: number | null;
  /** The translation now written on the tab, so the release can play it home. */
  readonly translation: number;
}
