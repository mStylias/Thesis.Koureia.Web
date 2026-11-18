import type { TreeModel } from './tree-model';
import type { TreeNode } from './tree-node';
import type { TreeKey, TreeSelectionState } from './tree.types';

/** Returns the visual checkbox state for a subtree. */
export function treeSelectionState<T, K extends TreeKey>(
  node: TreeNode<T, K>,
  selected: ReadonlySet<K>,
): TreeSelectionState {
  let eligible = 0;
  let selectedCount = 0;
  for (const candidate of node.traverse()) {
    if (isSelectionEligible(candidate)) {
      eligible += 1;
      if (selected.has(candidate.key)) {
        selectedCount += 1;
      }
    }
  }

  if (eligible > 0 && selectedCount === eligible) {
    return 'selected';
  }
  return selectedCount > 0 ? 'partial' : 'unselected';
}

/** Applies a checkbox toggle and derives every eligible ancestor state. */
export function toggleTreeSubtree<T, K extends TreeKey>(
  model: TreeModel<T, K>,
  current: readonly K[],
  node: TreeNode<T, K>,
  selected: boolean,
): readonly K[] {
  const next = new Set(sanitizeTreeSelection(model, current));

  for (const candidate of node.traverse()) {
    if (!isSelectionEligible(candidate)) {
      continue;
    }
    if (selected) {
      next.add(candidate.key);
    } else {
      next.delete(candidate.key);
    }
  }

  for (const ancestor of node.ancestors()) {
    if (!isSelectionEligible(ancestor)) {
      continue;
    }
    const descendants = ancestor
      .descendants()
      .filter((candidate) => isSelectionEligible(candidate));
    if (descendants.length > 0 && descendants.every((candidate) => next.has(candidate.key))) {
      next.add(ancestor.key);
    } else {
      next.delete(ancestor.key);
    }
  }

  return orderedTreeSelection(model, next);
}

/** Drops unknown and non-selectable values while preserving tree order. */
export function sanitizeTreeSelection<T, K extends TreeKey>(
  model: TreeModel<T, K>,
  values: readonly K[],
): readonly K[] {
  const requested = new Set(values);
  return Array.from(model.traverse())
    .filter((node) => isSelectionEligible(node) && requested.has(node.key))
    .map((node) => node.key);
}

/** Whether the node can directly participate in selection. */
export function isSelectionEligible<T, K extends TreeKey>(node: TreeNode<T, K>): boolean {
  return !node.disabled() && node.selectable();
}

function orderedTreeSelection<T, K extends TreeKey>(
  model: TreeModel<T, K>,
  selected: ReadonlySet<K>,
): readonly K[] {
  return Array.from(model.traverse())
    .filter((node) => selected.has(node.key))
    .map((node) => node.key);
}
