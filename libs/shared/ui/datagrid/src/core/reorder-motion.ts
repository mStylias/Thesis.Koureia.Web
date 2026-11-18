/**
 * The motion behind the grid's rearrangements.
 *
 * Rows travel vertically when a sort lands; columns travel horizontally when a
 * drag swaps them or the chooser adds or removes one. Both are FLIPs without
 * the "First" read — a row sits at `index * rowHeight` and a column at the sum
 * of the widths before it, so the previous place is already known and no
 * layout has to be measured. A column also carries its width into the play:
 * under `fit` the survivors of a change share out the width it freed, and a
 * FLIP is only continuous while its first frame reproduces the layout the user
 * was looking at. Both play through `element.animate()`, a platform
 * API and not the animation library the workspace has declined. Being
 * script-driven, they miss the global CSS reduced-motion rule and must ask for
 * the preference themselves.
 */
import type { GridLayout } from './column-layout.types';
import type { ColumnMotion, ColumnPlacement, Rearrangement } from './reorder-motion.types';
/** `--dur-slow`. The distance comes from the layout, so only the pace is set here. */
const DURATION = 260;

/** `--dur-base`. A column arriving has no distance to cover, so it takes less time. */
const FADE_DURATION = 180;

/** `--ease-out`: a reorder answers a press, and a press must leave on its own frame. */
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Names the animations this module owns, so a new move can cancel the one in flight. */
const ANIMATION_ID = 'dg-reorder';

/** False when the user asked for less motion. */
export function reorderMotionAllowed(): boolean {
  return (
    typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Plays `element` from `dx`/`dy` away to where it now sits. */
export function slideFrom(element: HTMLElement, dx: number, dy: number): void {
  play(
    element,
    [{ transform: `translate(${dx.toString()}px, ${dy.toString()}px)` }, { transform: 'none' }],
    DURATION,
  );
}

/**
 * Plays a column's cell from the box it had to the box it now has.
 *
 * The width is only animated when it changed. `width` is a layout property and
 * the travel alone rides the compositor, so an ordinary reorder — every column
 * keeping its width — must not pay for a property it does not move.
 */
export function travel(element: HTMLElement, motion: ColumnMotion): void {
  const from: Keyframe = { transform: `translateX(${motion.dx.toString()}px)` };
  const to: Keyframe = { transform: 'none' };
  if (motion.fromWidth !== motion.toWidth) {
    // Explicit on both ends: a grid item left at `auto` stretches to its track,
    // so the final frame has to name the width the track already gives it.
    from['width'] = `${motion.fromWidth.toString()}px`;
    to['width'] = `${motion.toWidth.toString()}px`;
  }
  play(element, [from, to], DURATION);
}

/** Plays `element` in where it has no travel to show it arriving. */
export function fadeIn(element: HTMLElement): void {
  play(element, [{ opacity: 0 }, { opacity: 1 }], FADE_DURATION);
}

/**
 * A move that arrives while the last one still runs cancels it: two live
 * animations of the same property leave the element wherever the older one
 * decides to end.
 */
function play(element: HTMLElement, keyframes: Keyframe[], duration: number): void {
  // jsdom implements no Web Animations API.
  if (typeof element.animate !== 'function' || typeof element.getAnimations !== 'function') {
    return;
  }
  for (const running of element.getAnimations()) {
    if (running.id === ANIMATION_ID) {
      running.cancel();
    }
  }
  element.animate(keyframes, { duration, easing: EASING, id: ANIMATION_ID });
}

/**
 * What two consecutive layouts ask to be played, or `null` when they ask for
 * nothing.
 *
 * A rearrangement is a drag swapping two columns, or the chooser adding or
 * removing one: every surviving column has a place to travel to. A change of
 * pinned side is refused, because pinning turns the cell sticky and a
 * canvas-space delta is the wrong distance there.
 *
 * A width change is refused only while the columns on both sides are the same
 * ones. That change is a resize drag or a container reflow, and a resize walks
 * the same offsets a pixel at a time. When a column joins or leaves, `fit`
 * re-spreads the container over the survivors and every one of them changes
 * width — refusing that is refusing the rearrangement itself.
 *
 * A column that leaves is not reported. Its cells are gone from the DOM by the
 * time this runs, and holding them there would leave grid items with no track
 * of their own; the neighbours closing the gap is what shows the removal. Under
 * `fit` they close it by growing as well as by travelling, which is why a move
 * carries both widths.
 */
export function rearrangement(
  before: ReadonlyMap<string, ColumnPlacement>,
  after: ReadonlyMap<string, ColumnPlacement>,
): Rearrangement | null {
  // The first render has nothing to travel from, and every column on it would
  // otherwise read as an arrival.
  if (before.size === 0) {
    return null;
  }
  const sameColumns = before.size === after.size && [...after.keys()].every((id) => before.has(id));
  const moves = new Map<string, ColumnMotion>();
  const arrived = new Set<string>();
  for (const [id, placement] of after) {
    const previous = before.get(id);
    if (previous === undefined) {
      arrived.add(id);
      continue;
    }
    if (previous.pinned !== placement.pinned) {
      return null;
    }
    const resized = previous.width !== placement.width;
    if (resized && sameColumns) {
      return null;
    }
    if (resized || previous.offset !== placement.offset) {
      moves.set(id, {
        dx: previous.offset - placement.offset,
        fromWidth: previous.width,
        toWidth: placement.width,
      });
    }
  }
  return moves.size === 0 && arrived.size === 0 ? null : { moves, arrived };
}

/**
 * Plays every cell of a column from the box it had to the box it now has, and
 * fades in a column that has just arrived. See {@link rearrangement} for what
 * plays and what does not.
 */
export class ColumnFlip {
  private placements = new Map<string, ColumnPlacement>();

  /** Call after every render. `root` is the element holding the header and body cells. */
  play<TRow>(root: HTMLElement | null | undefined, layout: GridLayout<TRow>): void {
    const previous = this.placements;
    this.placements = placementsOf(layout);
    if (root == null || !reorderMotionAllowed()) {
      return;
    }
    const change = rearrangement(previous, this.placements);
    if (change == null) {
      return;
    }
    // One pass over the cells rather than a query per column: a body window
    // holds a cell of every column in every row.
    for (const cell of root.querySelectorAll<HTMLElement>('[data-column]')) {
      const id = cell.getAttribute('data-column') ?? '';
      const motion = change.moves.get(id);
      if (motion !== undefined) {
        travel(cell, motion);
      } else if (change.arrived.has(id)) {
        fadeIn(cell);
      }
    }
  }
}

/** Where the columns sit, each one at the sum of the widths before it. */
export function placementsOf<TRow>(layout: GridLayout<TRow>): Map<string, ColumnPlacement> {
  const placements = new Map<string, ColumnPlacement>();
  let offset = 0;
  for (const entry of layout.columns) {
    placements.set(entry.id, { offset, width: entry.width, pinned: entry.pinned });
    offset += entry.width;
  }
  return placements;
}
