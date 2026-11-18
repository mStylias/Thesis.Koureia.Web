/**
 * The flattened body.
 *
 * Everything the virtualizer scrolls is one list of entries: data rows, group
 * header rows, group footer rows and expanded detail regions, in render order.
 * Each entry declares its height, so the offset index is arithmetic and no row
 * has to be measured.
 */
import { GROUP_PATH_SEPARATOR, groupPathKey } from './group-nodes';
import type { GroupNode } from './group-nodes.types';
import type { GridKey } from '../types/key.types';
import type { GridBodyItem, BodyItemOptions } from './body-items.types';

const GROUP_KEY_PREFIX = `${GROUP_PATH_SEPARATOR}group${GROUP_PATH_SEPARATOR}`;

/**
 * A group row's identity in the focus model.
 *
 * Focus walks entries, not data rows, so a group row needs a key in the same
 * space. {@link GROUP_PATH_SEPARATOR} prefixes it, which is what keeps a
 * synthetic key from colliding with a host one.
 */
export function groupFocusKey(path: readonly unknown[]): GridKey {
  return `${GROUP_KEY_PREFIX}${groupPathKey(path)}`;
}

/** True for a key {@link groupFocusKey} produced. */
export function isGroupFocusKey(key: GridKey): boolean {
  return typeof key === 'string' && key.startsWith(GROUP_KEY_PREFIX);
}

/**
 * Flattens rows — grouped or not — into the render order.
 *
 * A collapsed group contributes its header and nothing else, so collapsing is
 * what removes work rather than what hides it. A detail region follows its own
 * row, which is what keeps expansion keyed rather than positional.
 *
 * Call this only when the body carries something other than data rows. A plain
 * grid maps index to row directly and never materializes a list the size of
 * the dataset.
 */
export function buildBodyItems<TRow>(
  rows: readonly TRow[],
  groups: readonly GroupNode<TRow>[] | null,
  options: BodyItemOptions<TRow>,
): GridBodyItem<TRow>[] {
  const items: GridBodyItem<TRow>[] = [];
  const counter = { index: options.startIndex };
  if (groups == null || groups.length === 0) {
    for (const row of rows) {
      pushRow(items, row, 0, counter, options);
    }
    return items;
  }
  pushGroups(items, groups, counter, options);
  return items;
}

function pushGroups<TRow>(
  items: GridBodyItem<TRow>[],
  nodes: readonly GroupNode<TRow>[],
  counter: { index: number },
  options: BodyItemOptions<TRow>,
): void {
  for (const node of nodes) {
    const expanded = options.isGroupExpanded(node.path);
    items.push({
      kind: 'group',
      node,
      expanded,
      level: node.level,
      height: options.heights.group,
    });
    if (!expanded) {
      // A collapsed group hides its rows from the index as well, so the
      // absolute numbering follows what the user can actually count.
      counter.index += node.count;
      continue;
    }
    if (node.children.length > 0) {
      pushGroups(items, node.children, counter, options);
    } else {
      for (const row of node.rows) {
        pushRow(items, row, node.level + 1, counter, options);
      }
    }
    if (options.groupFooters) {
      items.push({
        kind: 'groupFooter',
        node,
        level: node.level,
        height: options.heights.groupFooter,
      });
    }
  }
}

function pushRow<TRow>(
  items: GridBodyItem<TRow>[],
  row: TRow,
  level: number,
  counter: { index: number },
  options: BodyItemOptions<TRow>,
): void {
  const key = options.keyOf(row);
  items.push({
    kind: 'data',
    key,
    row,
    dataIndex: counter.index,
    level,
    height: options.heights.data,
  });
  counter.index += 1;
  if (options.isRowExpanded(key)) {
    items.push({ kind: 'detail', key, row, level, height: options.heights.detail });
  }
}
