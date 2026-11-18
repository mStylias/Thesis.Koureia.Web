/**
 * Roving cell focus.
 *
 * The body is one tab stop: exactly one cell carries `tabindex="0"` and the
 * arrow keys move it. Movement and reconciliation are pure functions so the
 * keyboard model is testable without a DOM.
 */
import { computed, signal, type Signal } from '@angular/core';
import type { CellPosition } from './types/api.types';
import type { GridKey } from './types/key.types';
import type { FocusDirection, FocusContext } from './focus.store.types';

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), Math.max(0, length - 1));
}

/**
 * The position a direction moves to, or `null` when the grid has nothing to
 * focus. Movement saturates at the edges rather than wrapping, so holding an
 * arrow key never jumps the user to the opposite side.
 */
export function moveFocus(
  current: CellPosition | null,
  direction: FocusDirection,
  context: FocusContext,
): CellPosition | null {
  const { keys, columnIds } = context;
  if (keys.length === 0 || columnIds.length === 0) {
    return null;
  }
  const rowIndex = current == null ? -1 : keys.indexOf(current.key);
  const columnIndex = current == null ? -1 : columnIds.indexOf(current.columnId);
  // An unset or stale position enters at the first cell.
  const row = rowIndex < 0 ? 0 : rowIndex;
  const column = columnIndex < 0 ? 0 : columnIndex;
  if (current == null || rowIndex < 0 || columnIndex < 0) {
    return { key: keys[row], columnId: columnIds[column] };
  }

  const step = Math.max(1, Math.floor(context.pageStep));
  switch (direction) {
    case 'left':
      return { key: keys[row], columnId: columnIds[clampIndex(column - 1, columnIds.length)] };
    case 'right':
      return { key: keys[row], columnId: columnIds[clampIndex(column + 1, columnIds.length)] };
    case 'up':
      return { key: keys[clampIndex(row - 1, keys.length)], columnId: columnIds[column] };
    case 'down':
      return { key: keys[clampIndex(row + 1, keys.length)], columnId: columnIds[column] };
    case 'rowStart':
      return { key: keys[row], columnId: columnIds[0] };
    case 'rowEnd':
      return { key: keys[row], columnId: columnIds[columnIds.length - 1] };
    case 'gridStart':
      return { key: keys[0], columnId: columnIds[0] };
    case 'gridEnd':
      return { key: keys[keys.length - 1], columnId: columnIds[columnIds.length - 1] };
    case 'pageUp':
      return { key: keys[clampIndex(row - step, keys.length)], columnId: columnIds[column] };
    case 'pageDown':
      return { key: keys[clampIndex(row + step, keys.length)], columnId: columnIds[column] };
  }
}

/**
 * Keeps focus meaningful across a data change. A row that survives keeps
 * focus by key; a row that vanished hands focus to whatever now occupies its
 * position, which is the anchor closest to what the user was looking at.
 */
export function reconcileFocus(
  current: CellPosition | null,
  options: {
    previousKeys: readonly GridKey[];
    nextKeys: readonly GridKey[];
    columnIds: readonly string[];
  },
): CellPosition | null {
  const { previousKeys, nextKeys, columnIds } = options;
  if (current == null || nextKeys.length === 0 || columnIds.length === 0) {
    return null;
  }
  const columnId = columnIds.includes(current.columnId) ? current.columnId : columnIds[0];
  if (nextKeys.includes(current.key)) {
    return { key: current.key, columnId };
  }
  const previousIndex = previousKeys.indexOf(current.key);
  if (previousIndex < 0) {
    return null;
  }
  return { key: nextKeys[clampIndex(previousIndex, nextKeys.length)], columnId };
}

/**
 * Holds the focused cell and a request counter the view watches to move DOM
 * focus. The counter is what distinguishes "the user pressed a key" from
 * "the position changed because the data did".
 */
export class FocusStore {
  private readonly cellSig = signal<CellPosition | null>(null);
  private readonly requestSig = signal(0);

  /** The focused cell, or `null` when the grid has never been entered. */
  readonly cell: Signal<CellPosition | null> = computed(() => this.cellSig());

  /**
   * Increments whenever focus should move in the DOM. Reconciliation after a
   * data change deliberately leaves it alone, so the grid never steals focus
   * from elsewhere on the page while the user is typing.
   */
  readonly focusRequest: Signal<number> = computed(() => this.requestSig());

  isFocused(key: GridKey, columnId: string): boolean {
    const cell = this.cellSig();
    return cell?.key === key && cell.columnId === columnId;
  }

  /** Sets the position and asks the view to move DOM focus there. */
  focus(cell: CellPosition): void {
    this.cellSig.set(cell);
    this.requestSig.update((tick) => tick + 1);
  }

  /** Sets the position without moving DOM focus. */
  set(cell: CellPosition | null): void {
    this.cellSig.set(cell);
  }

  clear(): void {
    this.cellSig.set(null);
  }
}
