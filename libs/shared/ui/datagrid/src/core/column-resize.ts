/**
 * Column resize and reorder arithmetic.
 *
 * Both are pure: they take the resolved layout, or the places the columns
 * occupy, and return what to write. The drag handlers own no geometry of their
 * own, so a keyboard resize and a pointer drag go through the same function
 * and cannot drift apart.
 */
import type { GridLayout } from './column-layout.types';
import type { ColumnDef } from './types/column.types';
import type { ResizedColumn, ResizeOptions, ColumnBox } from './column-resize.types';

function boundsOf<TRow>(column: ColumnDef<TRow>, minWidth: number): { min: number; max: number } {
  return {
    min: Math.max(1, column.minWidth ?? minWidth),
    max: column.maxWidth != null && column.maxWidth > 0 ? column.maxWidth : Infinity,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), max));
}

/**
 * Resolves a resize drag into the widths to persist.
 *
 * Returns an empty array when the column cannot be resized or the delta
 * changes nothing, so a caller can skip the write and avoid a render.
 */
export function resizeColumn<TRow>(
  layout: GridLayout<TRow>,
  columnId: string,
  delta: number,
  options: ResizeOptions,
): ResizedColumn[] {
  const index = layout.columns.findIndex((entry) => entry.id === columnId);
  if (index < 0) {
    return [];
  }
  const target = layout.columns[index];
  if (target.column.allow?.resizing === false) {
    return [];
  }
  const bounds = boundsOf(target.column, options.minWidth);
  const width = clamp(target.width + delta, bounds.min, bounds.max);
  if (width === target.width) {
    return [];
  }

  if (options.mode === 'widen') {
    return [{ id: columnId, width }];
  }

  // Adjacent mode has to find a neighbour that can absorb the whole change.
  // If none can, the resize is refused rather than applied partially: a
  // partial apply silently changes the total width, which is the one thing
  // this mode exists to prevent.
  const neighbour = layout.columns
    .slice(index + 1)
    .find((entry) => entry.column.allow?.resizing !== false);
  if (neighbour === undefined) {
    return [];
  }
  const taken = width - target.width;
  const neighbourBounds = boundsOf(neighbour.column, options.minWidth);
  const neighbourWidth = clamp(neighbour.width - taken, neighbourBounds.min, neighbourBounds.max);
  if (neighbourWidth === neighbour.width) {
    return [];
  }
  // The neighbour may have clamped short of the full delta; give the target
  // back exactly what the neighbour released.
  const released = neighbour.width - neighbourWidth;
  return [
    { id: columnId, width: target.width + released },
    { id: neighbour.id, width: neighbourWidth },
  ];
}

/**
 * The visible index a column dragged onto `overId` lands on: the target's own
 * index, so the dragged column takes its place and the target shifts aside.
 *
 * Deliberately not a midpoint test. An insertion-point model makes the drop
 * depend on which half of the target the pointer is over, and inserting before
 * the column immediately to the right resolves to the position the dragged
 * column already occupies — a drop that highlights a target and then does
 * nothing. Anywhere on the target means the same thing here.
 *
 * The index is read against the layout as it stands now. It survives the
 * caller removing the dragged column first: a target to the right shifts down
 * one when that happens, which is exactly the slot the dragged column has to
 * land in to end up where the target was.
 */
export function reorderTarget<TRow>(
  layout: GridLayout<TRow>,
  draggedId: string,
  overId: string,
): number | null {
  const from = layout.columns.findIndex((entry) => entry.id === draggedId);
  const over = layout.columns.findIndex((entry) => entry.id === overId);
  if (from < 0 || over < 0 || from === over) {
    return null;
  }
  if (layout.columns[over].column.allow?.reordering === false) {
    return null;
  }
  return over;
}

/**
 * The column a drag at `x` must take the place of while the pointer is still
 * down, or `null` while it must stay where it is.
 *
 * Half the target has to be behind the pointer. A swap on contact reads as a
 * fault whenever the two columns differ in width: a narrow column dropped onto
 * a wide one leaves the pointer inside the wide column after it moves aside,
 * which is another contact, and the pair swaps back and forth for as long as
 * the pointer stays there. Past the midpoint the pointer always ends up in the
 * half that keeps the new order.
 *
 * Direction comes from where the two columns sit, not from their indices, so a
 * right-to-left header needs no separate case.
 */
export function swapTarget(
  boxes: readonly ColumnBox[],
  draggedId: string,
  x: number,
): string | null {
  const dragged = boxes.find((box) => box.id === draggedId);
  const over = boxes.find(
    (box) => box.id !== draggedId && x >= box.start && x < box.start + box.width,
  );
  if (dragged === undefined || over?.reorderable !== true) {
    return null;
  }
  const middle = over.start + over.width / 2;
  const passed = over.start > dragged.start ? x > middle : x < middle;
  return passed ? over.id : null;
}
