/**
 * Column groups, or banded headers (§5.1).
 *
 * A column that declares `columns` is a band: it carries a caption and covers
 * its children, and it holds no data of its own. Everything below the header
 * works on the leaves alone, so the store, the layout, the body and the query
 * are unchanged by a band — this module is the only place the nesting exists.
 *
 * A band's caption spans its leaves, so the leaves must stay next to each
 * other. {@link orderWithinBands} is what guarantees that: it runs on every
 * order the store writes, so a move that would carry a leaf out of its band
 * lands it back beside its siblings instead of splitting the caption above it.
 */
import type { ColumnDef } from './types/column.types';
import type {
  BandIndex,
  HeaderBandCell,
  HeaderLeafPlacement,
  HeaderMatrix,
  BandLayoutEntry,
} from './column-bands.types';
/** Whether a definition declares children, which makes it a band. */
export function isBand<TRow>(column: ColumnDef<TRow>): boolean {
  return column.columns != null && column.columns.length > 0;
}

/**
 * Flattens the declarations and records where each leaf sits.
 *
 * The leaf array is the input array itself when nothing is banded, so a grid
 * with no column groups allocates nothing and every computed downstream keeps
 * its cached value.
 */
export function indexColumnBands<TRow>(defs: readonly ColumnDef<TRow>[]): BandIndex<TRow> {
  if (!defs.some((def) => isBand(def))) {
    return {
      leaves: defs,
      bands: new Map(),
      pathOf: new Map(),
      parentOf: new Map(),
      depth: 0,
    };
  }
  const leaves: ColumnDef<TRow>[] = [];
  const bands = new Map<string, ColumnDef<TRow>>();
  const pathOf = new Map<string, readonly string[]>();
  const parentOf = new Map<string, string | null>();
  let depth = 0;
  const walk = (columns: readonly ColumnDef<TRow>[], path: readonly string[]): void => {
    for (const column of columns) {
      if (!isBand(column)) {
        leaves.push(column);
        if (path.length > 0) {
          pathOf.set(column.id, path);
          depth = Math.max(depth, path.length);
        }
        continue;
      }
      bands.set(column.id, column);
      parentOf.set(column.id, path.at(-1) ?? null);
      walk(column.columns ?? [], [...path, column.id]);
    }
  };
  walk(defs, []);
  return { leaves, bands, pathOf, parentOf, depth };
}

/**
 * Reorders so every band's leaves are contiguous, keeping the order the input
 * already had wherever it can.
 *
 * A band is placed where its first leaf appeared and the rest of its leaves
 * gather there. That is what an arrangement restored from before the band
 * existed needs, and what turns a move across a band boundary into a move of
 * the whole band rather than a header whose captions stop lining up.
 */
export function orderWithinBands(
  order: readonly string[],
  pathOf: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  if (pathOf.size === 0) {
    return order;
  }
  const grouped = groupByBand(order, pathOf, 0);
  return grouped.every((id, index) => id === order[index]) ? order : grouped;
}

/** Gathers the ids that share a band at `level`, recursing into each run. */
function groupByBand(
  ids: readonly string[],
  pathOf: ReadonlyMap<string, readonly string[]>,
  level: number,
): string[] {
  // Insertion order is first appearance, which is what keeps a band where the
  // user last saw it.
  const buckets = new Map<string, string[]>();
  const order: { key: string; band: string | null }[] = [];
  for (const id of ids) {
    const band = pathOf.get(id)?.[level] ?? null;
    // A column ungrouped at this level is its own bucket, so it never merges
    // with the column beside it.
    const key = band ?? ` ${id}`;
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [id]);
      order.push({ key, band });
    } else {
      bucket.push(id);
    }
  }
  const result: string[] = [];
  for (const entry of order) {
    const bucket = buckets.get(entry.key) ?? [];
    result.push(...(entry.band == null ? bucket : groupByBand(bucket, pathOf, level + 1)));
  }
  return result;
}

/** The leaf ids a band covers, in the order given. */
export function leavesOfBand(
  bandId: string,
  ids: readonly string[],
  pathOf: ReadonlyMap<string, readonly string[]>,
): string[] {
  return ids.filter((id) => pathOf.get(id)?.includes(bandId) === true);
}

/**
 * The leaf ids a header unit stands for: one leaf, or every leaf of a band.
 *
 * This is what makes a band move as one thing — the drag and the keyboard both
 * hand the store a unit id, and the store moves the whole run behind it.
 */
export function leavesOfUnit(
  unitId: string,
  ids: readonly string[],
  pathOf: ReadonlyMap<string, readonly string[]>,
): string[] {
  const owned = leavesOfBand(unitId, ids, pathOf);
  return owned.length > 0 ? owned : ids.filter((id) => id === unitId);
}

const NO_MATRIX: HeaderMatrix = { bandRows: [], leaves: new Map(), rows: 1 };

/**
 * Builds the banded header from the columns as they are actually rendered.
 *
 * Reading the render order rather than the declarations is what makes the
 * spans follow visibility, reordering and pinning: a hidden leaf is not there
 * to be counted, and a band whose leaves have all gone draws nothing.
 */
export function computeHeaderMatrix<TRow>(
  entries: readonly BandLayoutEntry[],
  index: BandIndex<TRow>,
): HeaderMatrix {
  if (index.depth === 0) {
    return NO_MATRIX;
  }
  const bandRows: HeaderBandCell[][] = [];
  for (let row = 0; row < index.depth; row += 1) {
    bandRows.push(bandRow(entries, index, row));
  }
  const leaves = new Map<string, HeaderLeafPlacement>();
  for (const entry of entries) {
    const path = index.pathOf.get(entry.id) ?? [];
    leaves.set(entry.id, {
      row: path.length,
      rowSpan: index.depth + 1 - path.length,
      parentId: path.at(-1) ?? null,
    });
  }
  return { bandRows, leaves, rows: index.depth + 1 };
}

/** One band row: consecutive columns under the same band become one cell. */
function bandRow<TRow>(
  entries: readonly BandLayoutEntry[],
  index: BandIndex<TRow>,
  row: number,
): HeaderBandCell[] {
  const cells: HeaderBandCell[] = [];
  let start = 0;
  while (start < entries.length) {
    const bandId = index.pathOf.get(entries[start].id)?.[row];
    if (bandId === undefined) {
      start += 1;
      continue;
    }
    let end = start + 1;
    while (end < entries.length && index.pathOf.get(entries[end].id)?.[row] === bandId) {
      end += 1;
    }
    const members = entries.slice(start, end);
    const band = index.bands.get(bandId);
    cells.push({
      id: bandId,
      caption: band?.caption ?? band?.field ?? bandId,
      parentId: index.parentOf.get(bandId) ?? null,
      row,
      colIndex: start + 1,
      colSpan: members.length,
      pinned: members[0].pinned,
      ...spanGeometry(members),
      columnIds: members.map((member) => member.id),
    });
    start = end;
  }
  return cells;
}

/** Sticky inset and frozen edge of a band cell, read off the members it covers. */
function spanGeometry(members: readonly BandLayoutEntry[]): {
  inset: number | null;
  edge: boolean;
} {
  // The inset comes from whichever member touches the frozen edge: a
  // start-pinned band sticks at its first column's offset, an end-pinned one
  // at its last column's.
  const anchor = members[0].pinned === 'end' ? members[members.length - 1] : members[0];
  return { inset: anchor.inset, edge: members.some((member) => member.edge) };
}
