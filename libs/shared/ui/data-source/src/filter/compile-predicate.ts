/**
 * Compiles a filter tree into an item predicate for local mode.
 *
 * Comparison semantics: dates compare by instant, the string search operators
 * (`contains`, `notContains`, `startsWith`, `endsWith`) fold case and
 * diacritics, ordering operators on `null` are always false.
 */
import type { FilterConditionNode, FilterNode } from '../data-source.types';
import { getPath } from '../paths';
import { foldValue } from '../text';
import { isConditionNode, isNotNode } from './filter-node';

/** Options of {@link compileFilterPredicate}. */
export interface CompilePredicateOptions<T> {
  /** Resolves a condition field to an item value. Defaults to dot-path access. */
  getValue?: (item: T, field: string) => unknown;
}

type Predicate<T> = (item: T) => boolean;

/** Collapses dates to instants so they compare by value. */
function normalize(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

function isEqual(a: unknown, b: unknown): boolean {
  const left = normalize(a);
  const right = normalize(b);
  return left === right || (left == null && right == null);
}

function compareOrdered(a: unknown, b: unknown): number | null {
  const left = normalize(a);
  const right = normalize(b);
  if (left == null || right == null) {
    return null;
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (
    (typeof left === 'number' || typeof left === 'bigint') &&
    (typeof right === 'number' || typeof right === 'bigint')
  ) {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  return null;
}

function containsText(
  value: unknown,
  needle: unknown,
  mode: 'contains' | 'starts' | 'ends',
): boolean {
  const haystack = foldValue(value);
  const search = foldValue(needle);
  if (haystack == null || search == null) {
    return false;
  }
  if (mode === 'starts') {
    return haystack.startsWith(search);
  }
  if (mode === 'ends') {
    return haystack.endsWith(search);
  }
  return haystack.includes(search);
}

function evaluateCondition(condition: FilterConditionNode, value: unknown): boolean {
  switch (condition.op) {
    case 'eq':
      return isEqual(value, condition.value);
    case 'ne':
      return !isEqual(value, condition.value);
    case 'lt': {
      const order = compareOrdered(value, condition.value);
      return order != null && order < 0;
    }
    case 'le': {
      const order = compareOrdered(value, condition.value);
      return order != null && order <= 0;
    }
    case 'gt': {
      const order = compareOrdered(value, condition.value);
      return order != null && order > 0;
    }
    case 'ge': {
      const order = compareOrdered(value, condition.value);
      return order != null && order >= 0;
    }
    case 'contains':
      return containsText(value, condition.value, 'contains');
    case 'notContains':
      return !containsText(value, condition.value, 'contains');
    case 'startsWith':
      return containsText(value, condition.value, 'starts');
    case 'endsWith':
      return containsText(value, condition.value, 'ends');
    case 'between': {
      const range = Array.isArray(condition.value) ? condition.value : [];
      const [min, max] = range as [unknown, unknown];
      const aboveMin = min == null || (compareOrdered(value, min) ?? -1) >= 0;
      const belowMax = max == null || (compareOrdered(value, max) ?? 1) <= 0;
      return aboveMin && belowMax;
    }
    case 'in': {
      const options = Array.isArray(condition.value) ? condition.value : [];
      return options.some((option) => isEqual(value, option));
    }
    case 'notIn': {
      const options = Array.isArray(condition.value) ? condition.value : [];
      return !options.some((option) => isEqual(value, option));
    }
    case 'isNull':
      return value == null;
    case 'isNotNull':
      return value != null;
  }
}

/**
 * Compiles the tree into one predicate. `null` and empty groups match every
 * item.
 */
export function compileFilterPredicate<T>(
  node: FilterNode | null | undefined,
  options?: CompilePredicateOptions<T>,
): Predicate<T> {
  if (node == null) {
    return () => true;
  }
  const getValue = options?.getValue ?? ((item: T, field: string) => getPath(item, field));
  if (isConditionNode(node)) {
    return (item) => evaluateCondition(node, getValue(item, node.field));
  }
  if (isNotNode(node)) {
    const inner = compileFilterPredicate(node.node, options);
    return (item) => !inner(item);
  }
  const parts = node.nodes.map((child) => compileFilterPredicate(child, options));
  if (parts.length === 0) {
    return () => true;
  }
  if (node.op === 'and') {
    return (item) => parts.every((part) => part(item));
  }
  return (item) => parts.some((part) => part(item));
}
