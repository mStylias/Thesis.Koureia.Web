/** Local aggregate computation. */
import { getPath } from '../paths';
import { defaultCompare } from './sort';
import type { AggregateSpec } from '../types/query.types';
import type { CustomAggregate } from './aggregate.types';

/** The result key of one aggregate: the custom identifier or `<field>:<type>`. */
export function aggregateKey(spec: AggregateSpec): string {
  return spec.custom ?? `${spec.field}:${spec.type}`;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return null;
}

/** Computes the requested aggregates over the rows. */
export function computeAggregates<TRow>(
  rows: readonly TRow[],
  specs: readonly AggregateSpec[],
  options?: {
    getValue?: (row: TRow, field: string) => unknown;
    customAggregates?: Readonly<Record<string, CustomAggregate>>;
  },
): Record<string, unknown> {
  const getValue = options?.getValue ?? ((row: TRow, field: string) => getPath(row, field));
  const result: Record<string, unknown> = {};
  for (const spec of specs) {
    const values = rows.map((row) => getValue(row, spec.field));
    result[aggregateKey(spec)] = computeOne(spec, values, options?.customAggregates);
  }
  return result;
}

function computeOne(
  spec: AggregateSpec,
  values: readonly unknown[],
  customAggregates?: Readonly<Record<string, CustomAggregate>>,
): unknown {
  switch (spec.type) {
    case 'count':
      return values.filter((value) => value != null).length;
    case 'sum':
      return numbers(values).reduce((total, value) => total + value, 0);
    case 'avg': {
      const present = numbers(values);
      return present.length === 0
        ? null
        : present.reduce((total, value) => total + value, 0) / present.length;
    }
    case 'min':
      return extremum(values, -1);
    case 'max':
      return extremum(values, 1);
    case 'custom': {
      const custom = spec.custom == null ? undefined : customAggregates?.[spec.custom];
      if (!custom) {
        throw new Error(
          `datagrid: no local implementation for custom aggregate "${spec.custom ?? ''}"`,
        );
      }
      return custom(values);
    }
  }
}

function numbers(values: readonly unknown[]): number[] {
  const result: number[] = [];
  for (const value of values) {
    const numeric = toNumber(value);
    if (numeric != null) {
      result.push(numeric);
    }
  }
  return result;
}

function extremum(values: readonly unknown[], sign: 1 | -1): unknown {
  let best: unknown = null;
  for (const value of values) {
    if (value == null) {
      continue;
    }
    if (best == null || defaultCompare(value, best) * sign > 0) {
      best = value;
    }
  }
  return best;
}
