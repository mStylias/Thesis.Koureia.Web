/** Walks over the header filter's entry tree. No DOM, no component state. */
import type { FilterNode } from '../core/types/filter.types';
import type { HeaderFilterEntry } from './datagrid-header-filter.types';

/** Every entry of a tree, parents before their children. */
export function flattenHeaderFilterEntries(
  roots: readonly HeaderFilterEntry[],
): readonly HeaderFilterEntry[] {
  return roots.flatMap((entry) => [entry, ...flattenHeaderFilterEntries(entry.children ?? [])]);
}

/**
 * The nodes a checked set selects. A checked parent contributes its own node
 * and its children are not visited: the parent already covers them, and one
 * bucket node is a shorter filter than every leaf under it.
 */
export function selectedHeaderFilterNodes(
  roots: readonly HeaderFilterEntry[],
  checked: ReadonlySet<string>,
): readonly FilterNode[] {
  const nodes: FilterNode[] = [];
  for (const entry of roots) {
    if (checked.has(entry.key)) {
      nodes.push(entry.node);
    } else {
      nodes.push(...selectedHeaderFilterNodes(entry.children ?? [], checked));
    }
  }
  return nodes;
}
