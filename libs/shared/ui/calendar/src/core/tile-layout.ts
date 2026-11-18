/**
 * Where tiles go. No Angular, no DOM.
 *
 * `packTimed` lays overlapping events side by side; `fitList` caps a cell's
 * list and hands back the count it dropped. Both take minutes and ids and
 * know nothing about what an event is.
 */
import type {
  FittedList,
  PackCluster,
  PackOptions,
  PackResult,
  PackedOverflow,
  PackedTile,
  TimedItem,
} from './tile-layout.types';

/**
 * Packs the timed events of one column.
 *
 * Events are swept in start order into **clusters**: a new cluster opens when
 * an event starts at or after everything before it has ended. Inside a
 * cluster each event takes the first column whose last event has ended, or
 * opens a new one. Every tile of a cluster reports the cluster's column count,
 * so widths line up across the cluster and a lone event still takes the whole
 * column.
 *
 * A cluster that would need more than `maxColumns` gives its remaining events
 * to one overflow chip rather than drawing sliver tiles: a busy hour with
 * eight parallel entries is read from a list, not from eight 12% columns.
 */
export function packTimed(items: readonly TimedItem[], options: PackOptions): PackResult {
  const minMinutes = Math.max(1, options.minMinutes);
  const maxColumns = Math.max(1, options.maxColumns);
  const sorted = items
    .map((item) => ({
      id: item.id,
      start: item.start,
      end: Math.max(item.end, item.start + minMinutes),
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));

  const tiles: PackedTile[] = [];
  const overflow: PackedOverflow[] = [];
  let cluster: PackCluster | null = null;

  const closeCluster = (): void => {
    if (cluster === null) {
      return;
    }
    const columns = cluster.columnEnds.length;
    for (const member of cluster.members) {
      tiles.push({ ...member, columns });
    }
    if (cluster.hidden.length > 0) {
      overflow.push({
        start: Math.min(...cluster.hidden.map((item) => item.start)),
        end: Math.max(...cluster.hidden.map((item) => item.end)),
        ids: cluster.hidden.map((item) => item.id),
      });
    }
    cluster = null;
  };

  for (const item of sorted) {
    if (cluster === null || item.start >= cluster.end) {
      closeCluster();
      cluster = { members: [], columnEnds: [], hidden: [], end: item.end };
    }
    cluster.end = Math.max(cluster.end, item.end);
    const column = cluster.columnEnds.findIndex((end) => end <= item.start);
    if (column >= 0) {
      cluster.columnEnds[column] = item.end;
      cluster.members.push({ ...item, column, columns: 0 });
    } else if (cluster.columnEnds.length < maxColumns) {
      cluster.columnEnds.push(item.end);
      cluster.members.push({ ...item, column: cluster.columnEnds.length - 1, columns: 0 });
    } else {
      cluster.hidden.push(item);
    }
  }
  closeCluster();

  return { tiles, overflow };
}

/**
 * The items a capped cell shows.
 *
 * When everything fits, everything shows. When it does not, one row is
 * surrendered to the "+N" chip, so the chip never pushes the cell taller than
 * the cap that asked for it.
 */
export function fitList<T>(items: readonly T[], capacity: number): FittedList<T> {
  const cap = Math.max(1, Math.floor(capacity));
  if (items.length <= cap) {
    return { visible: items, hidden: 0 };
  }
  const shown = Math.max(0, cap - 1);
  return { visible: items.slice(0, shown), hidden: items.length - shown };
}

/**
 * Tint steps for a count, for the year view's density.
 *
 * Four steps rather than a continuous ramp: a legend can name four, and the
 * eye cannot rank more than that in a 12px cell.
 */
export function densityStep(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  return 3;
}
