/**
 * Column geometry.
 *
 * Every column resolves to an explicit pixel width before render. Rows are
 * independent grid containers, so content-derived track sizes would differ
 * per row and columns would not line up: the width must be one number the
 * header and every row share.
 *
 * Pinned columns are hoisted to the edges of the render order. A column that
 * sticks from the middle of the order would let its neighbours slide under
 * it from the wrong side.
 */
import type { ColumnDef } from './types/column.types';
import type { ColumnLayout, GridLayout, ColumnLayoutOptions } from './column-layout.types';

function widthBounds<TRow>(
  column: ColumnDef<TRow>,
  options: ColumnLayoutOptions,
): { min: number; max: number } {
  return {
    min: Math.max(1, column.minWidth ?? options.minWidth),
    max: column.maxWidth != null && column.maxWidth > 0 ? column.maxWidth : Infinity,
  };
}

function resolveWidth<TRow>(column: ColumnDef<TRow>, options: ColumnLayoutOptions): number {
  const declared = column.width;
  const raw =
    typeof declared === 'number' && Number.isFinite(declared) && declared > 0
      ? declared
      : options.defaultWidth;
  const { min, max } = widthBounds(column, options);
  return Math.round(Math.min(Math.max(raw, min), max));
}

/**
 * Distributes surplus container width across the columns that can still
 * grow, in proportion to their resolved widths. Columns already at their
 * `maxWidth` keep their width and the remainder spreads over the rest.
 */
function growToFit<TRow>(
  entries: { column: ColumnDef<TRow>; width: number }[],
  options: ColumnLayoutOptions,
): void {
  const containerWidth = options.containerWidth;
  let surplus = containerWidth - entries.reduce((total, entry) => total + entry.width, 0);
  if (surplus <= 0) {
    return;
  }
  let growable = entries.filter((entry) => entry.width < (entry.column.maxWidth ?? Infinity));
  // Each pass hands out the surplus proportionally; columns that hit their
  // maximum drop out and the next pass redistributes what they refused.
  while (surplus >= 1 && growable.length > 0) {
    const base = growable.reduce((total, entry) => total + entry.width, 0);
    if (base <= 0) {
      break;
    }
    const share = surplus;
    let consumed = 0;
    for (const entry of growable) {
      const max = entry.column.maxWidth ?? Infinity;
      const wanted = entry.width + (share * entry.width) / base;
      const next = Math.min(wanted, max);
      consumed += next - entry.width;
      entry.width = next;
    }
    surplus -= consumed;
    if (consumed <= 0) {
      break;
    }
    growable = growable.filter((entry) => entry.width < (entry.column.maxWidth ?? Infinity));
  }
  settleToWholePixels(entries, options);
}

/**
 * Rounds the distributed widths to whole pixels and puts the rounding
 * remainder back on the columns that can hold it.
 *
 * The total has to land exactly on the container. A fraction of a pixel left
 * over is surplus the next fit pass hands out again, and a resize drag that
 * writes a rendered width back as a declared one would then fight that pass
 * for every frame it holds.
 */
function settleToWholePixels<TRow>(
  entries: { column: ColumnDef<TRow>; width: number }[],
  options: ColumnLayoutOptions,
): void {
  let residual = options.containerWidth;
  for (const entry of entries) {
    entry.width = Math.round(entry.width);
    residual -= entry.width;
  }
  for (let index = entries.length - 1; index >= 0 && residual !== 0; index -= 1) {
    const entry = entries[index];
    const bounds = widthBounds(entry.column, options);
    const next = Math.min(Math.max(entry.width + residual, bounds.min), bounds.max);
    residual -= next - entry.width;
    entry.width = next;
  }
}

/**
 * Resolves visible columns into render geometry. Input order is the display
 * order; pinned columns are hoisted to the edges within the result.
 */
export function computeColumnLayout<TRow>(
  columns: readonly ColumnDef<TRow>[],
  options: ColumnLayoutOptions,
): GridLayout<TRow> {
  const start: ColumnDef<TRow>[] = [];
  const middle: ColumnDef<TRow>[] = [];
  const end: ColumnDef<TRow>[] = [];
  for (const column of columns) {
    if (column.pinned === 'start') {
      start.push(column);
    } else if (column.pinned === 'end') {
      end.push(column);
    } else {
      middle.push(column);
    }
  }
  const ordered = [...start, ...middle, ...end];
  const entries = ordered.map((column) => ({ column, width: resolveWidth(column, options) }));

  if (options.fit && options.containerWidth > 0) {
    growToFit(entries, options);
  }

  const layouts: ColumnLayout<TRow>[] = entries.map((entry) => ({
    column: entry.column,
    id: entry.column.id,
    width: entry.width,
    pinned: entry.column.pinned ?? false,
    inset: null,
    edge: false,
  }));

  let offset = 0;
  for (let index = 0; index < start.length; index += 1) {
    const layout = layouts[index];
    layout.inset = offset;
    layout.edge = index === start.length - 1;
    offset += layout.width;
  }
  offset = 0;
  for (let index = layouts.length - 1; index >= layouts.length - end.length; index -= 1) {
    const layout = layouts[index];
    layout.inset = offset;
    layout.edge = index === layouts.length - end.length;
    offset += layout.width;
  }

  const totalWidth = layouts.reduce((total, layout) => total + layout.width, 0);
  return {
    columns: layouts,
    totalWidth,
    template: layouts.map((layout) => `${layout.width.toString()}px`).join(' '),
  };
}
