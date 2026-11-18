import { createKeyGetter, keyFields, keyTypeOf, serializeKey } from './keys';
import type { KeySpec } from './types/key.types';

interface Row {
  id: number;
  a: { b: { c: string } };
  code: string;
  region: string;
  bigId: bigint;
  nested: { value: unknown };
}

describe('createKeyGetter', () => {
  it('reads a single field selector', () => {
    const getKey = createKeyGetter<Row>('id');
    const row = { id: 42 } as Row;
    expect(getKey(row)).toBe(42);
  });

  it('reads a dot-path selector', () => {
    const getKey = createKeyGetter<Row>('a.b.c');
    const row = { a: { b: { c: 'deep' } } } as Row;
    expect(getKey(row)).toBe('deep');
  });

  it('passes a function selector through untouched', () => {
    const selector = (row: Row): string => `custom-${row.id.toString()}`;
    const getKey = createKeyGetter<Row>(selector);
    expect(getKey).toBe(selector);
  });

  it('builds a composite key from an array selector', () => {
    const getKey = createKeyGetter<Row>(['code', 'region']);
    const row = { code: 'X1', region: 'EU' } as Row;
    expect(getKey(row)).toBe('["X1","EU"]');
  });

  it('renders bigint composite parts with a trailing n', () => {
    const getKey = createKeyGetter<Row>(['bigId']);
    const row = { bigId: 123n } as Row;
    expect(getKey(row)).toBe('[123n]');
  });

  it('renders Date composite parts as an unquoted ISO string, unlike JSON-stringified strings', () => {
    const date = new Date('2024-03-01T00:00:00.000Z');
    const getKey = createKeyGetter<{ when: Date }>(['when']);
    expect(getKey({ when: date })).toBe(`[${date.toISOString()}]`);
  });

  it('renders null and undefined composite parts as null', () => {
    const getKey = createKeyGetter<{ a: unknown; b: unknown }>(['a', 'b']);
    expect(getKey({ a: null, b: undefined })).toBe('[null,null]');
  });

  it('passes number keys through toPrimitive', () => {
    const getKey = createKeyGetter<{ id: number }>('id');
    expect(getKey({ id: 7 })).toBe(7);
  });

  it('passes bigint keys through toPrimitive', () => {
    const getKey = createKeyGetter<{ id: bigint }>('id');
    expect(getKey({ id: 9n })).toBe(9n);
  });

  it('throws naming the field when a key field resolves to an object', () => {
    const getKey = createKeyGetter<{ id: unknown }>('id');
    expect(() => getKey({ id: { nope: true } })).toThrow(/"id"/);
  });

  it('throws naming the field when a key field resolves to undefined', () => {
    const getKey = createKeyGetter<{ id?: unknown }>('id');
    expect(() => getKey({})).toThrow(/"id"/);
  });

  it('throws when a composite part is a non-Date object', () => {
    const getKey = createKeyGetter<{ a: unknown }>(['a']);
    expect(() => getKey({ a: { nope: true } })).toThrow(/composite key part/);
  });

  it('accepts a spec object form and uses its selector', () => {
    const getKey = createKeyGetter<Row>({ selector: 'id', type: 'int' });
    expect(getKey({ id: 5 } as Row)).toBe(5);
  });
});

describe('keyTypeOf', () => {
  it('defaults to string for a bare string selector', () => {
    expect(keyTypeOf<Row>('id')).toBe('string');
  });

  it('defaults to string for a bare array selector', () => {
    expect(keyTypeOf<Row>(['code', 'region'])).toBe('string');
  });

  it('defaults to string for a bare function selector', () => {
    expect(keyTypeOf<Row>((row) => row.id)).toBe('string');
  });

  it('reads the declared type from the object form', () => {
    const spec: KeySpec<Row> = { selector: 'id', type: 'uuid' };
    expect(keyTypeOf(spec)).toBe('uuid');
  });

  it('defaults to string on the object form when type is absent', () => {
    const spec: KeySpec<Row> = { selector: 'id' };
    expect(keyTypeOf(spec)).toBe('string');
  });
});

describe('keyFields', () => {
  it('returns a single-element array for a string selector', () => {
    expect(keyFields<Row>('id')).toEqual(['id']);
  });

  it('returns the array itself for a composite selector', () => {
    expect(keyFields<Row>(['code', 'region'])).toEqual(['code', 'region']);
  });

  it('returns an empty array for a function selector', () => {
    expect(keyFields<Row>((row) => row.id)).toEqual([]);
  });

  it('reads the selector through the object form', () => {
    expect(keyFields<Row>({ selector: ['code', 'region'] })).toEqual(['code', 'region']);
  });
});

describe('serializeKey', () => {
  it('returns a string key as-is', () => {
    expect(serializeKey('abc')).toBe('abc');
  });

  it('serializes a number key via toString', () => {
    expect(serializeKey(42)).toBe('42');
  });

  it('serializes a bigint key via toString', () => {
    expect(serializeKey(42n)).toBe('42');
  });
});
