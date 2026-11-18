import type { CustomAggregate } from '../local-engine/aggregate.types';
import type { AggregateSpec } from '../types/query.types';

/** One group and everything under it. */
export interface GroupNode<TRow = unknown> {
  /** Values from the root group down to this one. Identifies it in state and in the API. */
  path: readonly unknown[];
  /** The grouped field at this level. */
  field: string;
  /** This group's own value. */
  value: unknown;
  /** Nesting depth, `0` for a top-level group. */
  level: number;
  /** Rows directly inside the group. Empty above the deepest level. */
  rows: readonly TRow[];
  children: readonly GroupNode<TRow>[];
  /** Data rows under the group, however deep. */
  count: number;
  /** Aggregates keyed as {@link aggregateKey} produces them, or `null`. */
  aggregates: Readonly<Record<string, unknown>> | null;
}

/** Host hooks group synthesis consults. */
export interface GroupOptions<TRow = unknown> {
  /** Resolves a field to a row value. Defaults to dot-path access. */
  getValue?: (row: TRow, field: string) => unknown;
  /** Aggregates computed per group. */
  aggregates?: readonly AggregateSpec[];
  /** Local implementations of custom aggregates, by identifier. */
  customAggregates?: Readonly<Record<string, CustomAggregate>>;
}
