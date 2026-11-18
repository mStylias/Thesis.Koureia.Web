/**
 * Group synthesis.
 *
 * Turns a flat row list into a nesting of groups, one level per
 * {@link GroupSpec}. Rows do not have to arrive in group order: groups are
 * collected by value and then ordered, so a remote source that sorted by
 * something else still groups correctly.
 */
import { serializeKey } from '../keys';
import { getPath } from '../paths';
import { computeAggregates } from '../local-engine/aggregate';
import { defaultCompare } from '../local-engine/sort';
import type { GroupResult, GroupSpec } from '../types/query.types';
import type { GroupNode, GroupOptions } from './group-nodes.types';

/**
 * Separates the levels of a serialized group path, and marks the synthetic
 * keys built from one.
 *
 * The ASCII unit separator, written as an escape so the source stays readable.
 * It is a character no caption or key value carries, which is what stops
 * `['a b']` and `['a', 'b']` from producing one key — and it survives a DOM
 * attribute, which NUL does not reliably do.
 */
export const GROUP_PATH_SEPARATOR = '\u001f';

/**
 * A stable string for a group path, for use as a `Map` key and in the
 * expansion set. Dates serialize by instant so two equal dates share a group.
 */
export function groupPathKey(path: readonly unknown[]): string {
  return path.map(taggedValueKey).join(GROUP_PATH_SEPARATOR);
}

/**
 * Every branch carries a type tag, so a group valued `null` and one valued the
 * string `"null"` are two groups rather than one — as are the number `1` and
 * the string `"1"`. Without the tag they would share an expansion state and a
 * collapse would close both. The header filter keys its distinct values the
 * same way, for the same reason.
 */
export function taggedValueKey(value: unknown): string {
  if (value == null) {
    return 'z';
  }
  if (value instanceof Date) {
    return `d${value.getTime().toString()}`;
  }
  if (typeof value === 'string') {
    return `s${value}`;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return `n${serializeKey(value)}`;
  }
  if (typeof value === 'boolean') {
    return value ? 'b1' : 'b0';
  }
  return `o${JSON.stringify(value)}`;
}

/**
 * Builds the group tree. The first spec is the outermost level; rows land in
 * the deepest node. Aggregates are computed over every row under a node, not
 * only its direct ones, so a nested group total still adds up.
 */
export function buildGroups<TRow>(
  rows: readonly TRow[],
  specs: readonly GroupSpec[],
  options: GroupOptions<TRow> = {},
): GroupNode<TRow>[] {
  if (specs.length === 0) {
    return [];
  }
  return buildLevel(rows, specs, 0, [], options);
}

function buildLevel<TRow>(
  rows: readonly TRow[],
  specs: readonly GroupSpec[],
  level: number,
  parentPath: readonly unknown[],
  options: GroupOptions<TRow>,
): GroupNode<TRow>[] {
  const spec = specs[level];
  const getValue = options.getValue ?? ((row: TRow, field: string) => getPath(row, field));
  const buckets = new Map<string, { value: unknown; rows: TRow[] }>();
  for (const row of rows) {
    const value = getValue(row, spec.field);
    const key = taggedValueKey(value);
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, { value, rows: [row] });
    } else {
      bucket.rows.push(row);
    }
  }
  const ordered = [...buckets.values()].sort(
    (a, b) => defaultCompare(a.value, b.value) * (spec.desc === true ? -1 : 1),
  );
  const last = level === specs.length - 1;
  return ordered.map((bucket) => {
    const path = [...parentPath, bucket.value];
    const children = last ? [] : buildLevel(bucket.rows, specs, level + 1, path, options);
    return {
      path,
      field: spec.field,
      value: bucket.value,
      level,
      rows: last ? bucket.rows : [],
      children,
      count: bucket.rows.length,
      aggregates: aggregatesFor(bucket.rows, options),
    };
  });
}

function aggregatesFor<TRow>(
  rows: readonly TRow[],
  options: GroupOptions<TRow>,
): Readonly<Record<string, unknown>> | null {
  const specs = options.aggregates;
  if (specs == null || specs.length === 0) {
    return null;
  }
  const computeOptions: Parameters<typeof computeAggregates<TRow>>[2] = {};
  if (options.getValue) {
    computeOptions.getValue = options.getValue;
  }
  if (options.customAggregates) {
    computeOptions.customAggregates = options.customAggregates;
  }
  return computeAggregates(rows, specs, computeOptions);
}

/**
 * Adapts a hierarchical result from a source that grouped remotely.
 *
 * The source owns the values, the counts and the aggregates; the grid only
 * gives the levels their field names, which the query already declared. A
 * level whose `items` are rows terminates the nesting even when more specs
 * remain — a paged group returns its first page of rows, not deeper groups.
 */
export function groupNodesFromResult<TRow>(
  groups: readonly GroupResult<TRow>[],
  specs: readonly GroupSpec[],
  level = 0,
  parentPath: readonly unknown[] = [],
): GroupNode<TRow>[] {
  const field = specs[level]?.field ?? '';
  return groups.map((group) => {
    const path = [...parentPath, group.key];
    const items = group.items ?? [];
    const nested = isGroupResultList<TRow>(items)
      ? groupNodesFromResult(items, specs, level + 1, path)
      : [];
    const rows = nested.length === 0 ? (items as readonly TRow[]) : [];
    return {
      path,
      field,
      value: group.key,
      level,
      rows,
      children: nested,
      count:
        group.count ??
        (nested.length === 0
          ? rows.length
          : nested.reduce((total, child) => total + child.count, 0)),
      aggregates: group.aggregates ?? null,
    };
  });
}

function isGroupResultList<TRow>(
  items: readonly TRow[] | readonly GroupResult<TRow>[],
): items is readonly GroupResult<TRow>[] {
  const first: unknown = items[0];
  return typeof first === 'object' && first !== null && 'key' in first && 'items' in first;
}

/** Total data rows under a group forest. */
export function countGroupRows<TRow>(nodes: readonly GroupNode<TRow>[]): number {
  return nodes.reduce((total, node) => total + node.count, 0);
}
