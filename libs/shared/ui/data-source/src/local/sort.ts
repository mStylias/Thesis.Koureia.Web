/** Local sorting over in-memory items. */
import type { SortSpec } from '../data-source.types';
import { getPath } from '../paths';

/** Orders two values. Negative, zero or positive, as `Array.sort` expects. */
export type Comparator = (a: unknown, b: unknown) => number;

/** Per-field overrides for local sorting. */
export interface SortFieldResolver<T = unknown> {
  /** Value used for ordering instead of the field value. */
  getSortValue?: (item: T) => unknown;
  /** Custom comparator over the sort values. */
  comparator?: Comparator;
}

/** Resolves a sort field to its overrides. */
export type SortResolver<T = unknown> = (field: string) => SortFieldResolver<T> | undefined;

/**
 * Default ordering: nulls last, dates by instant, numbers and bigints
 * numerically, strings by locale, booleans false-first.
 */
export function defaultCompare(a: unknown, b: unknown): number {
  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return left.localeCompare(right);
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
  return 0;
}

/**
 * Sorts a copy of the items by the given criteria. Stable. Null values sort
 * last in both directions and never reach a custom comparator.
 */
export function sortRows<T>(
  rows: readonly T[],
  specs: readonly SortSpec[],
  resolver?: SortResolver<T>,
): T[] {
  if (specs.length === 0) {
    return [...rows];
  }
  const criteria = specs.map((spec) => {
    const overrides = resolver?.(spec.field);
    const getValue = overrides?.getSortValue ?? ((item: T) => getPath(item, spec.field));
    return {
      getValue,
      compare: overrides?.comparator ?? defaultCompare,
      sign: spec.desc ? -1 : 1,
    };
  });
  return [...rows].sort((a, b) => {
    for (const { getValue, compare, sign } of criteria) {
      const left = getValue(a);
      const right = getValue(b);
      // The direction sign must not invert null placement.
      if (left == null || right == null) {
        if (left == null && right == null) {
          continue;
        }
        return left == null ? 1 : -1;
      }
      const order = compare(left, right);
      if (order !== 0) {
        return order * sign;
      }
    }
    return 0;
  });
}
