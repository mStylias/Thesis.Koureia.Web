/** Stable primitive identity of one item. */
export type DataKey = string | number | bigint;

/** Declared wire representation of an item key. */
export type KeyType = 'string' | 'int' | 'bigint' | 'uuid';

/** A key field, composite key fields, or a stable key-producing function. */
export type KeySelector<T> = string | readonly string[] | ((item: T) => DataKey);

/** Selector plus its wire representation. */
export interface KeySpecObject<T> {
  selector: KeySelector<T>;
  type?: KeyType;
}

/** How a source and its consumers identify one item. */
export type KeySpec<T> = KeySelector<T> | KeySpecObject<T>;

/** Comparison and membership operators in a transport-neutral filter. */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'le'
  | 'gt'
  | 'ge'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull';

/** Conjunction or disjunction over child nodes. */
export interface FilterGroupNode {
  op: 'and' | 'or';
  nodes: readonly FilterNode[];
}

/** Negation of one child node. */
export interface FilterNotNode {
  op: 'not';
  node: FilterNode;
}

/**
 * One comparison. `value` is absent for `isNull` / `isNotNull`, a
 * `[min, max]` tuple for `between`, and an array for `in` / `notIn`.
 */
export interface FilterConditionNode {
  field: string;
  op: FilterOperator;
  value?: unknown;
}

/** A normalized transport-neutral filter tree. */
export type FilterNode = FilterGroupNode | FilterNotNode | FilterConditionNode;

/** One requested sort, in precedence order. */
export interface SortSpec {
  field: string;
  desc?: boolean;
}

/** What one data load asks for. An absent facet is not requested. */
export interface LoadRequest {
  skip?: number;
  take?: number;
  search?: string | null;
  filter?: FilterNode | null;
  sort?: readonly SortSpec[];
  select?: readonly string[];
  expand?: readonly string[];
  requireTotalCount?: boolean;
  signal?: AbortSignal;
}

/** One loaded page. */
export interface LoadResult<T> {
  rows: readonly T[];
  totalCount?: number;
  /** Known to have more rows without requiring a total count. */
  hasMore?: boolean;
}

/** Bucket granularity for a distinct-values request. */
export type DistinctInterval =
  | 'year'
  | 'quarter'
  | 'month'
  | 'day'
  | 'hour'
  | 'minute'
  | { step: number };

/** A dataset-wide distinct-values request. */
export interface DistinctRequest {
  field: string;
  interval?: DistinctInterval;
  filter?: FilterNode | null;
  search?: string | null;
  skip?: number;
  take?: number;
  signal?: AbortSignal;
}

/** One exact value or source-produced bucket. */
export interface DistinctValue {
  value: unknown;
  count?: number;
  interval?: DistinctInterval;
}

/** A distinct-values response. */
export interface DistinctResult {
  values: readonly DistinctValue[];
  hasMore?: boolean;
}

/** Transport-neutral async data consumed by shared controls. */
export interface DataSource<T> {
  load(request: LoadRequest): Promise<LoadResult<T>>;
  /** Resolves persisted values without loading or searching the collection. */
  byKeys?(keys: readonly DataKey[], signal?: AbortSignal): Promise<readonly T[]>;
  /** Loads one level of a hierarchy. `null` is the root. */
  loadChildren?(parent: DataKey | null, request?: LoadRequest): Promise<LoadResult<T>>;
  /** Loads the dataset-wide domain of one field. */
  loadDistinct?(request: DistinctRequest): Promise<DistinctResult>;
}

/** A local collection or a host-controlled source. */
export type DataInput<T> = readonly T[] | DataSource<T>;

/**
 * Per-operation matrix for hybrid mode: `true` means the source performs the
 * operation, `false` means the consumer runs it locally over what came back.
 *
 * `grouping` and `aggregation` name facets only a wider request carries. They
 * are declared here so one matrix describes every consumer, and a consumer
 * with no such facet simply never has one to move.
 */
export interface RemoteOperations {
  filtering?: boolean;
  sorting?: boolean;
  grouping?: boolean;
  paging?: boolean;
  aggregation?: boolean;
  search?: boolean;
}

/** One keyed update: the key, and the members that change. */
export interface RowChange<T = unknown> {
  key: DataKey;
  changes: Partial<T>;
}

/** Keyed changes applied to a loaded set without a reload. */
export interface RowTransaction<T = unknown> {
  insert?: readonly T[];
  update?: readonly RowChange<T>[];
  remove?: readonly DataKey[];
}
