/** Filter tree guards and builders. */
import type {
  FilterConditionNode,
  FilterGroupNode,
  FilterNode,
  FilterNotNode,
  FilterOperator,
} from '../data-source.types';

/** True for an `and` / `or` node. */
export function isGroupNode(node: FilterNode): node is FilterGroupNode {
  return node.op === 'and' || node.op === 'or';
}

/** True for a `not` node. */
export function isNotNode(node: FilterNode): node is FilterNotNode {
  return node.op === 'not';
}

/** True for a field condition node. */
export function isConditionNode(node: FilterNode): node is FilterConditionNode {
  return node.op !== 'and' && node.op !== 'or' && node.op !== 'not';
}

/** Builds a condition node. */
export function where(field: string, op: FilterOperator, value?: unknown): FilterConditionNode {
  return value === undefined ? { field, op } : { field, op, value };
}

/** Builds a negation node. */
export function not(node: FilterNode): FilterNotNode {
  return { op: 'not', node };
}

function group(
  op: 'and' | 'or',
  nodes: readonly (FilterNode | null | undefined)[],
): FilterNode | null {
  const present: FilterNode[] = [];
  for (const node of nodes) {
    if (node == null) {
      continue;
    }
    // Same-op children flatten so composed trees stay canonical.
    if (isGroupNode(node) && node.op === op) {
      present.push(...node.nodes);
    } else {
      present.push(node);
    }
  }
  if (present.length === 0) {
    return null;
  }
  if (present.length === 1) {
    return present[0];
  }
  return { op, nodes: present };
}

/**
 * Combines nodes with `and`. Skips absent nodes, unwraps a single survivor,
 * returns `null` when nothing remains.
 */
export function and(...nodes: readonly (FilterNode | null | undefined)[]): FilterNode | null {
  return group('and', nodes);
}

/** Combines nodes with `or`. Same normalization as {@link and}. */
export function or(...nodes: readonly (FilterNode | null | undefined)[]): FilterNode | null {
  return group('or', nodes);
}
