/**
 * Translation between a column filter surface and the one filter tree.
 *
 * Every surface writes through {@link buildColumnFilter} and reads back
 * through {@link readColumnFilter}, so a value the user typed in the filter
 * row and a node a host set programmatically are the same thing.
 */
import { columnField } from '../column.store';
import { dayEnd, dayStart } from './date-filter';
import { isConditionNode, or, where } from './filter-node';
import { filterOperatorArity } from './operators';
import type { ColumnDef } from '../types/column.types';
import type { FilterNode, FilterOperator } from '../types/filter.types';
import type { ColumnFilterValue } from './column-filter.types';

/** True when an editor has collected nothing the query could use. */
export function isEmptyFilterValue(op: FilterOperator, value: unknown): boolean {
  switch (filterOperatorArity(op)) {
    case 'none':
      return false;
    case 'range': {
      const range = Array.isArray(value) ? value : [];
      return isBlank(range[0]) && isBlank(range[1]);
    }
    case 'list':
      return !Array.isArray(value) || value.length === 0;
    default:
      return isBlank(value);
  }
}

function isBlank(value: unknown): boolean {
  return value == null || value === '';
}

/**
 * Builds the sub-tree one column contributes, or `null` when its editor is
 * empty. A `between` keeps a missing bound as `null` rather than collapsing to
 * `ge` / `le`, so the node the user sees round-trips back into the same editor.
 */
export function buildColumnFilter<TRow>(
  column: ColumnDef<TRow>,
  op: FilterOperator,
  value: unknown,
): FilterNode | null {
  if (isEmptyFilterValue(op, value)) {
    return null;
  }
  if (column.filterExpression != null) {
    return column.filterExpression(value, op);
  }
  const field = columnField(column);
  if (filterOperatorArity(op) === 'none') {
    return where(field, op);
  }
  if (column.dataType === 'date') {
    return dayCondition(field, op, value);
  }
  if (column.dataType === 'datetime') {
    return datetimeCondition(field, op, value);
  }
  return where(field, op, value);
}

/** A column whose editor collects a day rather than an instant. */
function datetimeCondition(field: string, op: FilterOperator, value: unknown): FilterNode | null {
  if (op === 'between') {
    const range = Array.isArray(value) ? value : [];
    const start = range[0] instanceof Date ? range[0] : dayStart(range[0]);
    const end = range[1] instanceof Date ? range[1] : dayEnd(range[1]);
    return where(field, op, [start, end]);
  }
  return value instanceof Date ? where(field, op, value) : dayCondition(field, op, value);
}

/**
 * Widens a day to the instants that bound it, so a `datetime` column matches
 * every row on that day rather than only the ones stored at midnight. `eq`
 * becomes the whole day; an ordering operator takes the boundary that leaves
 * the named day on the side the user meant.
 */
function dayCondition(field: string, op: FilterOperator, value: unknown): FilterNode | null {
  switch (op) {
    case 'eq': {
      const start = dayStart(value);
      const end = dayEnd(value);
      return start == null || end == null ? null : where(field, 'between', [start, end]);
    }
    case 'between': {
      const range = Array.isArray(value) ? value : [];
      return where(field, 'between', [dayStart(range[0]), dayEnd(range[1])]);
    }
    case 'lt':
    case 'ge': {
      const start = dayStart(value);
      return start == null ? null : where(field, op, start);
    }
    case 'le':
    case 'gt': {
      const end = dayEnd(value);
      return end == null ? null : where(field, op, end);
    }
    default:
      return where(field, op, value);
  }
}

/**
 * Reads a node back into an editor value, or `null` when the filter row
 * cannot represent it — a group, a negation, or a condition on another field.
 * §7.3 requires the grid to say so rather than drop what it cannot show.
 */
export function readColumnFilter(node: FilterNode, field: string): ColumnFilterValue | null {
  if (!isConditionNode(node) || node.field !== field) {
    return null;
  }
  return node.value === undefined ? { op: node.op } : { op: node.op, value: node.value };
}

/**
 * Combines the entries a header filter checked into one node.
 *
 * Equality tests on one field collapse into a single `in`: a remote source
 * serializes that as one clause instead of a chain of disjunctions, and the
 * filter row can still read it back.
 */
export function combineFilterOptions(nodes: readonly FilterNode[]): FilterNode | null {
  if (nodes.length === 0) {
    return null;
  }
  const first = nodes[0];
  if (nodes.length > 1 && isConditionNode(first)) {
    const field = first.field;
    const equalities = nodes.filter(
      (node) => isConditionNode(node) && node.op === 'eq' && node.field === field,
    );
    if (equalities.length === nodes.length) {
      return where(
        field,
        'in',
        nodes.map((node) => (isConditionNode(node) ? node.value : undefined)),
      );
    }
  }
  return or(...nodes);
}

/** Conditions of a top-level `and`, or the node itself when it is not one. */
export function flattenAnd(node: FilterNode | null): readonly FilterNode[] {
  if (node == null) {
    return [];
  }
  return node.op === 'and' ? node.nodes : [node];
}
