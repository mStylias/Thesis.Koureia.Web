/**
 * The editable form of the filter tree, as the expression editor holds it.
 *
 * {@link FilterNode} is normalized and anonymous: `and(x)` collapses to `x`, a
 * `between` keeps its bounds in one array, and nothing carries identity. An
 * editor needs the opposite — a group that survives having its last child
 * removed, a range whose two ends are edited apart, and a stable id per row so
 * `@for` can track it. This model is that form, and the two conversions below
 * are the only place the difference lives.
 */
import { and, isGroupNode, isNotNode, not, or, where } from './filter-node';
import { isEmptyFilterValue } from './column-filter';
import { filterOperatorArity } from './operators';
import type { FilterNode, FilterOperator } from '../types/filter.types';
import type {
  BuilderConditionItem,
  BuilderGroupItem,
  BuilderItem,
  BuilderConditionBuilder,
} from './filter-builder-model.types';

let sequence = 0;

/** A fresh item id. Unique per document, which is all a `track` needs. */
function nextId(): string {
  sequence += 1;
  return `fb${sequence.toString()}`;
}

/** Builds one condition row. */
export function builderCondition(
  field = '',
  op: FilterOperator = 'eq',
  value: unknown = null,
  valueEnd: unknown = null,
): BuilderConditionItem {
  return { kind: 'condition', id: nextId(), field, op, value, valueEnd };
}

/** Builds one group. */
export function builderGroup(
  op: 'and' | 'or' = 'and',
  children: readonly BuilderItem[] = [],
  negated = false,
): BuilderGroupItem {
  return { kind: 'group', id: nextId(), op, children, negated };
}

/**
 * Reads a filter tree into the editable form. The root is always a group, so
 * an editor opened on a single condition can still add a second one.
 */
export function builderTreeFromNode(node: FilterNode | null): BuilderGroupItem {
  if (node == null) {
    return builderGroup();
  }
  const item = toItem(node);
  return item.kind === 'group' ? item : builderGroup('and', [item]);
}

function toItem(node: FilterNode): BuilderItem {
  if (isGroupNode(node)) {
    return builderGroup(node.op, node.nodes.map(toItem));
  }
  if (isNotNode(node)) {
    const inner = node.node;
    // `not` over a group is that group negated. Over anything else it is a
    // negated `and` of one, which `and()` unwraps again on the way back out,
    // so the tree round-trips unchanged.
    return isGroupNode(inner)
      ? builderGroup(inner.op, inner.nodes.map(toItem), true)
      : builderGroup('and', [toItem(inner)], true);
  }
  if (filterOperatorArity(node.op) === 'range' && Array.isArray(node.value)) {
    return builderCondition(node.field, node.op, node.value[0] ?? null, node.value[1] ?? null);
  }
  return builderCondition(node.field, node.op, node.value ?? null);
}

/**
 * Writes the editable form back into a filter tree.
 *
 * An empty condition and a group left with no usable child contribute nothing
 * rather than a node the source would have to interpret. The editor marks
 * those rows instead of dropping them quietly — §7.3.
 */
export function builderTreeToNode(
  root: BuilderGroupItem,
  buildCondition: BuilderConditionBuilder = defaultBuilderCondition,
): FilterNode | null {
  return itemToNode(root, buildCondition);
}

function itemToNode(item: BuilderItem, build: BuilderConditionBuilder): FilterNode | null {
  if (item.kind === 'condition') {
    return build(item);
  }
  const children = item.children
    .map((child) => itemToNode(child, build))
    .filter((node): node is FilterNode => node != null);
  const combined = item.op === 'and' ? and(...children) : or(...children);
  if (combined == null) {
    return null;
  }
  return item.negated ? not(combined) : combined;
}

/**
 * The condition builder used when no column model is available. A grid passes
 * its own, which routes through `buildColumnFilter` so a date widens to its
 * day and a column's `filterExpression` still decides.
 */
export function defaultBuilderCondition(item: BuilderConditionItem): FilterNode | null {
  if (item.field === '') {
    return null;
  }
  const arity = filterOperatorArity(item.op);
  const value = arity === 'range' ? [item.value ?? null, item.valueEnd ?? null] : item.value;
  if (isEmptyFilterValue(item.op, value)) {
    return null;
  }
  return arity === 'none' ? where(item.field, item.op) : where(item.field, item.op, value);
}

/** Replaces one item, returning a new tree. Unknown ids leave the tree alone. */
export function updateBuilderItem(
  root: BuilderGroupItem,
  id: string,
  update: (item: BuilderItem) => BuilderItem,
): BuilderGroupItem {
  if (root.id === id) {
    const next = update(root);
    return next.kind === 'group' ? next : root;
  }
  return { ...root, children: root.children.map((child) => updateChild(child, id, update)) };
}

function updateChild(
  item: BuilderItem,
  id: string,
  update: (item: BuilderItem) => BuilderItem,
): BuilderItem {
  if (item.id === id) {
    return update(item);
  }
  return item.kind === 'group' ? updateBuilderItem(item, id, update) : item;
}

/** Appends an item to one group. */
export function insertBuilderItem(
  root: BuilderGroupItem,
  groupId: string,
  item: BuilderItem,
): BuilderGroupItem {
  return updateBuilderItem(root, groupId, (target) =>
    target.kind === 'group' ? { ...target, children: [...target.children, item] } : target,
  );
}

/** Drops one item. The root is never removed — it is the expression itself. */
export function removeBuilderItem(root: BuilderGroupItem, id: string): BuilderGroupItem {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) => (child.kind === 'group' ? removeBuilderItem(child, id) : child)),
  };
}

/** Condition rows in the whole tree, which is what "empty expression" means. */
export function builderConditionCount(root: BuilderGroupItem): number {
  return root.children.reduce(
    (total, child) => total + (child.kind === 'group' ? builderConditionCount(child) : 1),
    0,
  );
}
