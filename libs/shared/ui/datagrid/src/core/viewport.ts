import type { RowWindow, RowWindowOptions, RowOffsets } from './viewport.types';

/** Clamps a value into a range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalizes a raw dimension: rejects `NaN`, negatives and infinities, and
 * rounds fractions away. A zero or invalid row height would divide the whole
 * window by zero, so callers normalize before any arithmetic.
 */
export function safeRowHeight(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(value));
}

function safeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function safeLength(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The range of rows to render for the current scroll offset. Empty datasets
 * produce an empty window rather than a negative range.
 */
export function computeRowWindow(options: RowWindowOptions): RowWindow {
  const rowHeight = safeRowHeight(options.rowHeight);
  const rowCount = safeCount(options.rowCount);
  if (rowCount === 0) {
    return { start: 0, end: 0 };
  }
  const overscan = safeCount(options.overscan ?? 0);
  const scrollTop = Math.max(0, safeLength(options.scrollTop));
  const viewportHeight = safeLength(options.viewportHeight);

  const first = Math.floor(scrollTop / rowHeight);
  // A viewport that is not measured yet still renders one band, so the first
  // paint is never empty while a ResizeObserver catches up.
  const visible = viewportHeight > 0 ? Math.ceil(viewportHeight / rowHeight) + 1 : 1;
  const start = clamp(first - overscan, 0, rowCount);
  const end = clamp(first + visible + overscan, 0, rowCount);
  return { start, end: Math.max(start, end) };
}

class UniformOffsets implements RowOffsets {
  readonly uniform = true;
  readonly totalHeight: number;

  constructor(
    readonly count: number,
    private readonly height: number,
  ) {
    this.totalHeight = count * height;
  }

  offsetOf(index: number): number {
    return clamp(index, 0, this.count) * this.height;
  }

  heightOf(): number {
    return this.height;
  }

  indexAt(offset: number): number {
    return clamp(Math.floor(Math.max(0, offset) / this.height), 0, Math.max(0, this.count - 1));
  }
}

class VariableOffsets implements RowOffsets {
  readonly uniform = false;
  readonly count: number;
  /** Cumulative offsets, one longer than the heights: the last is the total. */
  private readonly starts: number[];

  constructor(private readonly heights: readonly number[]) {
    this.count = heights.length;
    this.starts = new Array<number>(heights.length + 1);
    let offset = 0;
    for (let index = 0; index < heights.length; index += 1) {
      this.starts[index] = offset;
      offset += heights[index];
    }
    this.starts[heights.length] = offset;
  }

  get totalHeight(): number {
    return this.starts[this.count];
  }

  offsetOf(index: number): number {
    return this.starts[clamp(index, 0, this.count)];
  }

  heightOf(index: number): number {
    return this.heights[clamp(index, 0, Math.max(0, this.count - 1))] ?? 0;
  }

  /** Binary search over the prefix sums: the entries are ascending by construction. */
  indexAt(offset: number): number {
    const target = Math.max(0, offset);
    let low = 0;
    let high = this.count - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.starts[middle] <= target) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return Math.max(0, low);
  }
}

const EMPTY_OFFSETS: RowOffsets = new UniformOffsets(0, 1);

/**
 * Builds the offset index. Pass `heights` only when the entries differ; a
 * `null` list takes the uniform path, which is what an ordinary grid of data
 * rows uses and what keeps a scroll frame free of allocation.
 */
export function createRowOffsets(
  heights: readonly number[] | null,
  options: { count: number; rowHeight: number },
): RowOffsets {
  const rowHeight = safeRowHeight(options.rowHeight);
  if (heights == null) {
    const count = safeCount(options.count);
    return count === 0 ? EMPTY_OFFSETS : new UniformOffsets(count, rowHeight);
  }
  if (heights.length === 0) {
    return EMPTY_OFFSETS;
  }
  const normalized = heights.map(safeRowHeight);
  return normalized.every((height) => height === normalized[0])
    ? new UniformOffsets(normalized.length, normalized[0])
    : new VariableOffsets(normalized);
}

/** The range of entries to render for the current scroll offset. */
export function computeWindow(
  offsets: RowOffsets,
  options: { scrollTop: number; viewportHeight: number; overscan?: number },
): RowWindow {
  if (offsets.count === 0) {
    return { start: 0, end: 0 };
  }
  const overscan = safeCount(options.overscan ?? 0);
  const scrollTop = Math.max(0, safeLength(options.scrollTop));
  const viewportHeight = safeLength(options.viewportHeight);
  const first = offsets.indexAt(scrollTop);
  // A viewport that is not measured yet still renders one band, so the first
  // paint is never empty while a ResizeObserver catches up.
  const last = viewportHeight > 0 ? offsets.indexAt(scrollTop + viewportHeight) + 1 : first + 1;
  const start = clamp(first - overscan, 0, offsets.count);
  const end = clamp(last + overscan, 0, offsets.count);
  return { start, end: Math.max(start, end) };
}

/** Pixel offset of a row from the top of the canvas. */
export function rowOffset(index: number, rowHeight: number): number {
  return Math.max(0, safeCount(index)) * safeRowHeight(rowHeight);
}

/** Total scrollable height of the canvas. */
export function totalCanvasHeight(rowCount: number, rowHeight: number): number {
  return safeCount(rowCount) * safeRowHeight(rowHeight);
}

/** How many rows one `Page Up` or `Page Down` step moves. Always at least one. */
export function pageStep(viewportHeight: number, rowHeight: number): number {
  const rows = Math.floor(safeLength(viewportHeight) / safeRowHeight(rowHeight));
  return Math.max(1, rows);
}

/**
 * The scroll offset that brings a row fully into view, or `null` when it is
 * already visible. Scrolls the minimum distance: up to the row's top edge, or
 * down to its bottom edge.
 */
export function scrollOffsetToReveal(options: {
  index: number;
  rowHeight: number;
  scrollTop: number;
  viewportHeight: number;
}): number | null {
  const rowHeight = safeRowHeight(options.rowHeight);
  const viewportHeight = safeLength(options.viewportHeight);
  const top = rowOffset(options.index, rowHeight);
  const bottom = top + rowHeight;
  const currentTop = Math.max(0, safeLength(options.scrollTop));
  if (top < currentTop) {
    return top;
  }
  if (viewportHeight > 0 && bottom > currentTop + viewportHeight) {
    return Math.max(0, bottom - viewportHeight);
  }
  return null;
}

/** As {@link scrollOffsetToReveal}, for an entry in a variable-height body. */
export function offsetToRevealEntry(
  offsets: RowOffsets,
  options: { index: number; scrollTop: number; viewportHeight: number },
): number | null {
  if (offsets.count === 0) {
    return null;
  }
  const viewportHeight = safeLength(options.viewportHeight);
  const top = offsets.offsetOf(options.index);
  const bottom = top + offsets.heightOf(options.index);
  const currentTop = Math.max(0, safeLength(options.scrollTop));
  if (top < currentTop) {
    return top;
  }
  if (viewportHeight > 0 && bottom > currentTop + viewportHeight) {
    return Math.max(0, bottom - viewportHeight);
  }
  return null;
}
