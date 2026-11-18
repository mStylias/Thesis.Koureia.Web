import type { FilterNode, FilterOperator } from '../types/filter.types';

/** One comparison row of the expression editor. */
export interface BuilderConditionItem {
  kind: 'condition';
  /** Identity within the tree. Stable across edits, so `@for` tracks a row. */
  id: string;
  /** Query field the condition targets. Empty until the user picks one. */
  field: string;
  op: FilterOperator;
  value: unknown;
  /** Upper bound of a `between`, kept apart so emptying one end keeps the other. */
  valueEnd: unknown;
}

/** One `and` / `or` group, negated by `not` when {@link negated} is set. */
export interface BuilderGroupItem {
  kind: 'group';
  id: string;
  op: 'and' | 'or';
  negated: boolean;
  children: readonly BuilderItem[];
}

/** A node of the editable tree. */
export type BuilderItem = BuilderConditionItem | BuilderGroupItem;

/** Builds the node one condition row contributes, or `null` when it is empty. */
export type BuilderConditionBuilder = (item: BuilderConditionItem) => FilterNode | null;
