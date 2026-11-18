import type { DataKey, KeySelector, KeySpec, KeySpecObject, KeyType } from './data-source.types';
import { getPath } from './paths';

function isSpecObject<T>(spec: KeySpec<T>): spec is KeySpecObject<T> {
  return typeof spec === 'object' && !Array.isArray(spec);
}

function toKey(value: unknown, field: string): DataKey {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return value;
  }
  throw new Error(`data-source: key field "${field}" must produce a string, number or bigint`);
}

function serializePart(value: unknown): string {
  if (value == null) {
    return 'null';
  }
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    throw new Error('data-source: a composite key part must be a primitive');
  }
  return JSON.stringify(value);
}

/** Builds the stable item-to-key function declared by a key specification. */
export function createKeyGetter<T>(spec: KeySpec<T>): (item: T) => DataKey {
  const selector: KeySelector<T> = isSpecObject(spec) ? spec.selector : spec;
  if (typeof selector === 'function') {
    return selector;
  }
  if (typeof selector === 'string') {
    return (item) => toKey(getPath(item, selector), selector);
  }
  return (item) => `[${selector.map((field) => serializePart(getPath(item, field))).join(',')}]`;
}

/** The key's declared wire type. Bare selectors default to `string`. */
export function keyTypeOf<T>(spec: KeySpec<T>): KeyType {
  return isSpecObject(spec) ? (spec.type ?? 'string') : 'string';
}

/** Fields read by a field-based key. Functions expose no projection fields. */
export function keyFields<T>(spec: KeySpec<T>): readonly string[] {
  const selector = isSpecObject(spec) ? spec.selector : spec;
  if (typeof selector === 'function') {
    return [];
  }
  return typeof selector === 'string' ? [selector] : selector;
}

/** Stable string form for maps, DOM tracking, and adapter caches. */
export function serializeKey(key: DataKey): string {
  return typeof key === 'string' ? key : key.toString();
}

/** Whether a value implements the async data-source contract. */
export function isDataSource<T>(
  value: readonly T[] | import('./data-source.types').DataSource<T>,
): value is import('./data-source.types').DataSource<T> {
  return !Array.isArray(value);
}
