/**
 * The remaining request facets: ordering, free-text search, key membership, and aggregation.
 */
import {
  foldText,
  keyTypeOf,
  serializeKey,
  type DataKey,
  type KeySpec,
  type SortSpec,
} from '@ui/data-source';
import { guid, type PlainObject } from '@synax/client/core';
import { odataPath } from './field';
import type { ODataFilter } from './filter';

/**
 * `SortSpec[]` into `$orderby` entries, in precedence order.
 *
 * Emitted as strings rather than the tuple form, because a nested path is only expressible
 * that way: `customer/name desc`.
 */
export function toOrderBy(sort: readonly SortSpec[] | undefined): string[] | undefined {
  if (sort === undefined || sort.length === 0) {
    return undefined;
  }
  return sort.map((spec) =>
    spec.desc === true ? `${odataPath(spec.field)} desc` : odataPath(spec.field),
  );
}

/**
 * A grouped query's `$orderby` prefix.
 *
 * The binding does not send `$apply=groupby` for a row load: that returns group rows and no
 * contents, and assembling a `GroupResult` tree from it needs a second request per expanded
 * group, which no consumer issues yet. Ordering by the group fields first is what the local
 * engine does too, so rows at least arrive in group order and the consumer groups them.
 */
export function groupOrderBy(
  group: readonly { field: string; desc?: boolean }[] | undefined,
): string[] {
  return (group ?? []).map((spec) =>
    spec.desc === true ? `${odataPath(spec.field)} desc` : odataPath(spec.field),
  );
}

/**
 * A free-text search as an `or` of `contains` over the declared fields.
 *
 * The needle is **folded** — lowercased and stripped of diacritics — because the fields named
 * here are the server's normalized columns. The server's `contains` emits a bare `LIKE` with
 * no `lower()`, so it is case- and accent-sensitive; a folded needle against a folded column
 * is what makes this match what the local engine matches.
 *
 * Returns `undefined` when there is nothing to search or nowhere to search it.
 */
export function toSearchFilter(
  search: string | null | undefined,
  searchFields: readonly string[] | undefined,
): ODataFilter | undefined {
  const needle = foldText(search?.trim() ?? '');
  if (needle === '' || searchFields === undefined || searchFields.length === 0) {
    return undefined;
  }
  const parts: PlainObject[] = searchFields.map((field) => ({
    [odataPath(field)]: { contains: needle },
  }));
  return parts.length === 1 ? parts[0] : { or: parts };
}

/** A key value as OData spells it: a bare GUID for a uuid key, the value itself otherwise. */
function keyLiteral<T>(key: DataKey, spec: KeySpec<T>): unknown {
  return keyTypeOf(spec) === 'uuid' ? guid(String(key)) : key;
}

/**
 * A key-membership filter.
 *
 * A single field becomes `id in (...)`. A composite key cannot: `in` compares one member, so
 * the only correct form is an `or` of `and` groups, one per key, which is why a composite
 * lookup is worth batching harder than a simple one.
 *
 * Returns `'false'` for no keys — an empty membership test matches nothing, and omitting it
 * would match everything.
 */
export function toKeyFilter<T>(
  keys: readonly DataKey[],
  spec: KeySpec<T>,
  fields: readonly string[],
  path: (field: string) => string,
): ODataFilter {
  if (keys.length === 0) {
    return 'false';
  }

  if (fields.length === 1) {
    const field = path(fields[0]);
    return { [field]: { in: keys.map((key) => keyLiteral(key, spec)) } };
  }

  const groups = keys.map((key) => {
    // A composite key arrives serialized, as `createKeyGetter` produced it: `["X1","EU"]`.
    const parts = parseCompositeKey(key);
    const conditions: PlainObject[] = fields.map((field, index) => ({
      [path(field)]: { eq: parts[index] ?? null },
    }));
    return conditions.length === 1 ? conditions[0] : { and: conditions };
  });

  return groups.length === 1 ? groups[0] : { or: groups };
}

/**
 * Reads back the parts of a serialized composite key.
 *
 * `createKeyGetter` writes `["X1","EU"]` — JSON members inside brackets — so this parses that
 * form and falls back to treating the key as one opaque value when it is not one.
 */
function parseCompositeKey(key: DataKey): unknown[] {
  const text = serializeKey(key);
  if (!text.startsWith('[') || !text.endsWith(']')) {
    return [key];
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as unknown[]) : [key];
  } catch {
    // A bigint part is written as `123n`, which is not JSON. Such a key cannot be split
    // reliably, so it travels whole and the server reports the mismatch.
    return [key];
  }
}

/** One aggregate the query asks for, in the shared vocabulary. */
export interface AggregateRequest {
  field: string;
  type: string;
  custom?: string;
}

/** An `$apply=aggregate` clause plus the aliases it answers under. */
export interface AggregateTranslation {
  /** The `aggregate(...)` transform, or `undefined` when nothing is expressible. */
  transform?: { aggregate: string[] };
  /** OData alias to the key the consumer reads the value back under. */
  aliases: ReadonlyMap<string, string>;
  /** Requests with no OData form, reported rather than dropped in silence. */
  unsupported: readonly AggregateRequest[];
}

/** OData's names for the aggregate methods. `count` is the `$count` pseudo-member. */
const AGGREGATE_METHOD: Readonly<Record<string, string>> = {
  sum: 'sum',
  min: 'min',
  max: 'max',
  avg: 'average',
};

/** The key a consumer reads one aggregate back under. Mirrors the grid's `aggregateKey`. */
function resultKey(request: AggregateRequest): string {
  return request.custom ?? `${request.field}:${request.type}`;
}

/**
 * `AggregateSpec[]` into an `$apply=aggregate(...)` clause.
 *
 * The alias cannot be the consumer's own key: that reads `price:sum`, and a colon is not an
 * OData identifier. Each aggregate therefore travels under a safe alias and is mapped back.
 *
 * A `custom` aggregate has no OData form at all and is reported as unsupported — the consumer
 * then shows nothing rather than a number that means something else.
 */
export function toAggregate(
  aggregates: readonly AggregateRequest[] | undefined,
  path: (field: string) => string,
): AggregateTranslation {
  const clauses: string[] = [];
  const aliases = new Map<string, string>();
  const unsupported: AggregateRequest[] = [];

  for (const request of aggregates ?? []) {
    if (request.type === 'count') {
      const alias = uniqueAlias('count_all', aliases);
      clauses.push(`$count as ${alias}`);
      aliases.set(alias, resultKey(request));
      continue;
    }

    const method = AGGREGATE_METHOD[request.type];
    if (method === undefined) {
      unsupported.push(request);
      continue;
    }

    const alias = uniqueAlias(`${safeIdentifier(request.field)}_${request.type}`, aliases);
    clauses.push(`${path(request.field)} with ${method} as ${alias}`);
    aliases.set(alias, resultKey(request));
  }

  return {
    ...(clauses.length > 0 ? { transform: { aggregate: clauses } } : {}),
    aliases,
    unsupported,
  };
}

/** An OData identifier built from a possibly-nested field name. */
function safeIdentifier(field: string): string {
  return field.replace(/[^A-Za-z0-9_]/g, '_');
}

/** Keeps two aggregates over the same field and method from colliding on one alias. */
function uniqueAlias(base: string, taken: ReadonlyMap<string, string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}_${suffix.toString()}`)) {
    suffix += 1;
  }
  return `${base}_${suffix.toString()}`;
}
