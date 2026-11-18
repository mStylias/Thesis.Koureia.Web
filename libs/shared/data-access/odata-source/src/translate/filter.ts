/**
 * `FilterNode` into `odata-query`'s `Filter`.
 *
 * Always structured, never a hand-built string. That is what escapes the value instead of
 * concatenating it, so a search for `O'Brien` becomes `contains(name,'O''Brien')` and not an
 * expression whose literal ends early.
 */
import {
  foldText,
  isConditionNode,
  isGroupNode,
  type FilterConditionNode,
  type FilterNode,
} from '@ui/data-source';
import { guid, raw as rawLiteral, type PlainObject } from '@synax/client/core';

/**
 * A translated filter: a structured tree, or one of the two literals.
 *
 * The literals are needed because some conditions carry no rows either way and OData has no
 * structured spelling for them. `in ()` is the case that forces it — an empty membership test
 * matches nothing, and **dropping it would mean matching everything**, which for a
 * `byKeys([])` or a header filter with nothing ticked is a wrong answer rather than a missing
 * one. `odata-query` passes a plain string through verbatim, so the literals compose inside
 * `and` and `or` as themselves.
 */
export type ODataFilter = PlainObject | 'true' | 'false';

/** How a value reaches the wire. */
export interface FilterContext {
  /** Rewrites a contract field into its OData path. */
  path: (field: string) => string;
  /**
   * Serializes a `Date`, when the host needs something other than the default.
   *
   * Absent is the right default: `odata-query` emits a `Date` as an unquoted instant, which is
   * what `Edm.DateTimeOffset` expects. Converting to a string here instead makes it a **string
   * literal** — `createdAt ge '2026-01-01T00%3A00%3A00.000Z'` — which is a different type and a
   * different comparison.
   */
  date?: (value: Date) => unknown;
  /** Contract fields that hold GUIDs. Their string values travel as bare GUIDs. */
  guidFields?: ReadonlySet<string>;
  /** Contract fields that hold a calendar day. Their values travel as a bare `YYYY-MM-DD`. */
  dateFields?: ReadonlySet<string>;
  /**
   * Contract members that are lists. A condition on `services.serviceId` becomes
   * `services/any(s: s/serviceId …)`.
   */
  collections?: readonly string[];
  /** Folded twins of text fields. A text condition goes to the twin with a folded needle. */
  normalizedFields?: Readonly<Record<string, string>>;
}

/** The text operators a folded twin answers. */
const FOLDED_OPERATORS: ReadonlySet<string> = new Set([
  'eq',
  'ne',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
]);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function value(raw: unknown, context: FilterContext, field?: string): unknown {
  if (field !== undefined && context.dateFields?.has(field) === true) {
    const day = dayOf(raw);
    if (day !== null) return day;
  }
  if (raw instanceof Date && context.date !== undefined) {
    return context.date(raw);
  }
  // A quoted GUID is an `Edm.String`, and the server refuses to compare it with an `Edm.Guid`.
  if (typeof raw === 'string' && field !== undefined && context.guidFields?.has(field) === true) {
    return guid(raw);
  }
  return raw;
}

/**
 * A day as an unquoted `Edm.Date` literal. A `Date` is read from its local parts: the grid builds
 * a day's bounds at local midnight and at the last local millisecond, and both name that day.
 */
function dayOf(input: unknown): ReturnType<typeof rawLiteral> | null {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    const pad = (part: number): string => String(part).padStart(2, '0');
    return rawLiteral(
      `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`,
    );
  }
  return typeof input === 'string' && DAY.test(input) ? rawLiteral(input) : null;
}

function values(raw: unknown, context: FilterContext, field?: string): unknown[] {
  return (Array.isArray(raw) ? (raw as unknown[]) : []).map((item) => value(item, context, field));
}

/** Moves a text condition onto its folded twin. Any other condition is returned as it is. */
function toFolded(node: FilterConditionNode, context: FilterContext): FilterConditionNode {
  const twin = context.normalizedFields?.[node.field];
  if (twin === undefined || !FOLDED_OPERATORS.has(node.op) || typeof node.value !== 'string') {
    return node;
  }
  return { ...node, field: twin, value: foldText(node.value) };
}

/** The list member a field reaches into, and the path inside one element. */
function collectionOf(
  field: string,
  context: FilterContext,
): { collection: string; member: string } | null {
  for (const collection of context.collections ?? []) {
    if (field.startsWith(`${collection}.`)) {
      return { collection, member: field.slice(collection.length + 1) };
    }
  }
  return null;
}

/**
 * A condition on a list element, as `any()`.
 *
 * The negated operators test the positive form inside the lambda and negate outside it:
 * "has no service in (…)" is `not services/any(s: s/serviceId in (…))`, not "has a service
 * outside (…)".
 */
function translateInCollection(
  node: FilterConditionNode,
  target: { collection: string; member: string },
  context: FilterContext,
): ODataFilter | undefined {
  const negated = node.op === 'notIn' || node.op === 'notContains';
  const positive: FilterConditionNode = negated
    ? { ...node, op: node.op === 'notIn' ? 'in' : 'contains' }
    : node;
  const inner = translateCondition(positive, {
    ...context,
    // Inside the lambda the path is relative to the element, which `odata-query` prefixes.
    path: (field) => context.path(field.slice(target.collection.length + 1)),
    collections: [],
  });
  if (inner === undefined || inner === 'true' || inner === 'false') {
    return negated ? negate(inner) : inner;
  }
  const lambda: PlainObject = { [context.path(target.collection)]: { any: inner } };
  return negated ? negate(lambda) : lambda;
}

function condition(field: string, operator: string, operand: unknown): PlainObject {
  return { [field]: { [operator]: operand } };
}

/**
 * Negates a translated filter.
 *
 * The literals are flipped here rather than handed to `odata-query`'s `not`, which reads a
 * string operand as a member name and emits `not eq 'false'`.
 */
function negate(inner: ODataFilter | undefined): ODataFilter | undefined {
  if (inner === undefined) {
    // Nothing was constrained, so negating it constrains nothing either. Reporting `false`
    // here would drop every row for an empty sub-tree.
    return undefined;
  }
  if (inner === 'false') {
    return 'true';
  }
  if (inner === 'true') {
    return 'false';
  }
  return { not: inner };
}

function translateCondition(
  original: FilterConditionNode,
  context: FilterContext,
): ODataFilter | undefined {
  const target = collectionOf(original.field, context);
  if (target !== null) {
    return translateInCollection(original, target, context);
  }

  const node = toFolded(original, context);
  const field = context.path(node.field);
  const single = (): unknown => value(node.value, context, node.field);

  switch (node.op) {
    case 'eq':
    case 'ne':
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge':
      return condition(field, node.op, single());

    // `odata-query` spells the string functions lower-case and emits them as calls:
    // `contains(name,'x')`, `startswith(...)`, `endswith(...)`.
    case 'contains':
      return condition(field, 'contains', single());
    case 'startsWith':
      return condition(field, 'startswith', single());
    case 'endsWith':
      return condition(field, 'endswith', single());
    case 'notContains':
      return negate(condition(field, 'contains', single()));

    // Both bounds on one field, which `odata-query` joins: `price ge 10 and price le 20`.
    // An absent bound leaves that side open.
    case 'between': {
      const [min, max] = values(node.value, context, node.field);
      const bounds: PlainObject = {};
      if (min !== undefined && min !== null) {
        bounds['ge'] = min;
      }
      if (max !== undefined && max !== null) {
        bounds['le'] = max;
      }
      return Object.keys(bounds).length === 0 ? undefined : { [field]: bounds };
    }

    case 'in': {
      const options = values(node.value, context, node.field);
      return options.length === 0 ? 'false' : condition(field, 'in', options);
    }
    case 'notIn': {
      const options = values(node.value, context, node.field);
      // Excluded from nothing, so nothing is excluded.
      return options.length === 0 ? undefined : negate(condition(field, 'in', options));
    }

    case 'isNull':
      return condition(field, 'eq', null);
    case 'isNotNull':
      return condition(field, 'ne', null);
  }
}

/**
 * Translates one tree. `undefined` means the tree constrains nothing, so the caller leaves
 * `$filter` off the query rather than sending an empty one.
 */
export function toODataFilter(
  node: FilterNode | null | undefined,
  context: FilterContext,
): ODataFilter | undefined {
  if (node == null) {
    return undefined;
  }

  if (isConditionNode(node)) {
    return translateCondition(node, context);
  }

  if (!isGroupNode(node)) {
    return negate(toODataFilter(node.node, context));
  }

  const parts = node.nodes
    .map((child) => toODataFilter(child, context))
    .filter((part): part is ODataFilter => part !== undefined);

  if (node.op === 'and') {
    // One impossible member makes the conjunction impossible, and a vacuous member adds
    // nothing to it.
    if (parts.includes('false')) {
      return 'false';
    }
    const kept = parts.filter((part) => part !== 'true');
    if (kept.length === 0) {
      return parts.length === 0 ? undefined : 'true';
    }
    return kept.length === 1 ? kept[0] : { and: kept };
  }

  // One vacuous member makes the disjunction vacuous, and an impossible member adds nothing.
  if (parts.includes('true')) {
    return 'true';
  }
  const kept = parts.filter((part) => part !== 'false');
  if (kept.length === 0) {
    return parts.length === 0 ? undefined : 'false';
  }
  return kept.length === 1 ? kept[0] : { or: kept };
}
