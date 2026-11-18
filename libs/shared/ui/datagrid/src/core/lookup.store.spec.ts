import { describe, expect, it, vi } from 'vitest';
import { LookupStore } from './lookup.store';
import type { GridDataSource, Query, QueryResult } from './types/query.types';

interface Branch {
  id: number;
  name: string;
}

const BRANCHES: readonly Branch[] = [
  { id: 1, name: 'Nicosia' },
  { id: 2, name: 'Larnaca' },
  { id: 3, name: 'Limassol' },
];

function source(rows: readonly Branch[]): GridDataSource<Branch> & { calls: Query[] } {
  const calls: Query[] = [];
  return {
    calls,
    load: (query: Query): Promise<QueryResult<Branch>> => {
      calls.push(query);
      const skip = query.skip ?? 0;
      const needle = (query.search ?? '').toLocaleLowerCase();
      const matched =
        needle === '' ? rows : rows.filter((row) => row.name.toLocaleLowerCase().includes(needle));
      return Promise.resolve({ rows: matched.slice(skip, skip + (query.take ?? matched.length)) });
    },
  };
}

describe('static collections', () => {
  it('resolves a stored value to its display value', () => {
    const store = new LookupStore();
    store.ensure('branch', { source: BRANCHES, value: 'id', display: 'name' });
    expect(store.displayOf('branch', 2)).toBe('Larnaca');
  });

  it('reads value and display through functions as well as field names', () => {
    const store = new LookupStore();
    store.ensure('branch', {
      source: BRANCHES,
      value: (item: Branch) => item.id,
      display: (item: Branch) => item.name.toUpperCase(),
    });
    expect(store.displayOf('branch', 1)).toBe('NICOSIA');
  });

  it('answers undefined for a value the collection does not cover, so the cell falls back', () => {
    const store = new LookupStore();
    store.ensure('branch', { source: BRANCHES, value: 'id', display: 'name' });
    expect(store.displayOf('branch', 99)).toBeUndefined();
  });

  it('keeps a number and the string it prints as apart', () => {
    const store = new LookupStore();
    store.ensure('code', {
      source: [
        { id: 1, name: 'numeric' },
        { id: '1', name: 'text' },
      ],
      value: 'id',
      display: 'name',
    });
    expect(store.displayOf('code', 1)).toBe('numeric');
    expect(store.displayOf('code', '1')).toBe('text');
  });
});

describe('collection identity', () => {
  it('loads once for the same spec object', () => {
    const store = new LookupStore();
    const spec = { source: BRANCHES, value: 'id' as const, display: 'name' as const };
    const before = store.version();
    store.ensure('branch', spec);
    const after = store.version();
    store.ensure('branch', spec);
    expect(store.version()).toBe(after);
    expect(after).not.toBe(before);
  });

  it('reloads when the spec changes, because the collection did', () => {
    const store = new LookupStore();
    store.ensure('branch', { source: BRANCHES, value: 'id', display: 'name' });
    store.ensure('branch', { source: [{ id: 1, name: 'Renamed' }], value: 'id', display: 'name' });
    expect(store.displayOf('branch', 1)).toBe('Renamed');
  });

  it('changes its version on every write, so an equal reload still redraws', () => {
    const store = new LookupStore();
    store.ensure('branch', { source: BRANCHES, value: 'id', display: 'name' });
    const settled = store.version();
    store.ensure('branch', { source: BRANCHES, value: 'id', display: 'name' });
    expect(store.version()).toBeGreaterThan(settled);
  });
});

describe('data sources', () => {
  it('loads the collection once, not once per row', async () => {
    const store = new LookupStore();
    const remote = source(BRANCHES);
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));
    expect(remote.calls).toHaveLength(1);
    expect(store.displayOf('branch', 3)).toBe('Limassol');
  });

  it('reports a collection larger than one page as partial', async () => {
    const store = new LookupStore();
    const many = Array.from({ length: 500 }, (_, index) => ({
      id: index,
      name: `Branch ${index}`,
    }));
    store.ensure('branch', { source: source(many), value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));
    expect(store.partial('branch')).toBe(true);
  });

  it('leaves the raw values showing when the collection fails to load', async () => {
    const store = new LookupStore();
    store.ensure('branch', {
      source: { load: () => Promise.reject(new Error('offline')) },
      value: 'id',
      display: 'name',
    });
    await vi.waitUntil(() => !store.loading('branch'));
    expect(store.displayOf('branch', 1)).toBeUndefined();
    expect(store.entries('branch')).toEqual([]);
  });

  it('pages and searches the source without touching the display map', async () => {
    const store = new LookupStore();
    const remote = source(BRANCHES);
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));
    const page = await store.page('branch', { search: 'nic' });
    expect(page.entries).toEqual([{ value: 1, display: 'Nicosia' }]);
    expect(store.displayOf('branch', 2)).toBe('Larnaca');
  });

  it('searches a static collection locally', async () => {
    const store = new LookupStore();
    store.ensure('branch', { source: BRANCHES, value: 'id', display: 'name' });
    const page = await store.page('branch', { search: 'l' });
    expect(page.entries.map((entry) => entry.display)).toEqual(['Larnaca', 'Limassol']);
  });

  it('reports another page from one extra entry rather than from a count', async () => {
    const store = new LookupStore();
    store.ensure('branch', { source: source(BRANCHES), value: 'id', display: 'name' });
    const page = await store.page('branch', { take: 2 });
    expect(page.entries).toHaveLength(2);
    expect(page.hasMore).toBe(true);
  });
});

/** A source that also answers by key, the way an OData binding does. */
function keyedSource(
  rows: readonly Branch[],
): GridDataSource<Branch> & { calls: Query[]; keyCalls: (readonly unknown[])[] } {
  const base = source(rows);
  const keyCalls: (readonly unknown[])[] = [];
  return {
    ...base,
    keyCalls,
    byKeys: (keys) => {
      keyCalls.push(keys);
      const wanted = new Set(keys);
      return Promise.resolve(rows.filter((row) => wanted.has(row.id)));
    },
  };
}

describe('resolving values by key', () => {
  /** More branches than one prefetch covers, so the tail renders as raw codes. */
  const MANY: readonly Branch[] = Array.from({ length: 500 }, (_, index) => ({
    id: index,
    name: `Branch ${index.toString()}`,
  }));

  it('resolves a value the prefetch did not reach', async () => {
    const store = new LookupStore();
    const remote = keyedSource(MANY);
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));

    // The defect: beyond the prefetch the cell shows its stored code.
    expect(store.displayOf('branch', 480)).toBeUndefined();

    await store.resolveValues('branch', [480]);

    expect(store.displayOf('branch', 480)).toBe('Branch 480');
    expect(remote.keyCalls).toEqual([[480]]);
  });

  it('asks only for values the collection does not already cover', async () => {
    const store = new LookupStore();
    const remote = keyedSource(MANY);
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));

    await store.resolveValues('branch', [1, 2, 480]);

    // 1 and 2 came with the prefetch; only the uncovered value travels.
    expect(remote.keyCalls).toEqual([[480]]);
  });

  it('asks once per value, however often the rows name it', async () => {
    const store = new LookupStore();
    const remote = keyedSource(MANY);
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));

    await store.resolveValues('branch', [480, 480, 481]);
    await store.resolveValues('branch', [480, 481]);

    expect(remote.keyCalls).toEqual([[480, 481]]);
  });

  it('does not re-ask for a value the source did not know', async () => {
    const store = new LookupStore();
    const remote = keyedSource(MANY);
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));

    await store.resolveValues('branch', [9999]);
    await store.resolveValues('branch', [9999]);

    // Re-requesting a miss on every render is the request-per-row §5.3 forbids.
    expect(remote.keyCalls).toEqual([[9999]]);
    expect(store.displayOf('branch', 9999)).toBeUndefined();
  });

  it('is a no-op for a source that cannot answer by key', async () => {
    const store = new LookupStore();
    const remote = source(MANY);
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));
    const before = remote.calls.length;

    await store.resolveValues('branch', [480]);

    // Presence is the capability: without it the prefetch and its partial
    // notice stand, and nothing extra is requested.
    expect(remote.calls).toHaveLength(before);
    expect(store.displayOf('branch', 480)).toBeUndefined();
  });

  it('is a no-op for a static collection', async () => {
    const store = new LookupStore();
    store.ensure('branch', { source: BRANCHES, value: 'id', display: 'name' });

    await store.resolveValues('branch', [99]);

    expect(store.displayOf('branch', 99)).toBeUndefined();
  });

  it('keeps the raw value showing when the lookup fails', async () => {
    const store = new LookupStore();
    const remote: GridDataSource<Branch> = {
      load: () => Promise.resolve({ rows: [] }),
      byKeys: () => Promise.reject(new Error('offline')),
    };
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));

    await store.resolveValues('branch', [1]);

    expect(store.displayOf('branch', 1)).toBeUndefined();
  });

  it('redraws the cells that were holding a raw code', async () => {
    const store = new LookupStore();
    const remote = keyedSource(MANY);
    store.ensure('branch', { source: remote, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));
    const before = store.version();

    await store.resolveValues('branch', [480]);

    expect(store.version()).toBeGreaterThan(before);
  });

  it('forgets what it tried when the collection is replaced', async () => {
    const store = new LookupStore();
    const first = keyedSource(MANY);
    store.ensure('branch', { source: first, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));
    await store.resolveValues('branch', [9999]);

    const second = keyedSource([...MANY, { id: 9999, name: 'New' }]);
    store.ensure('branch', { source: second, value: 'id', display: 'name' });
    await vi.waitUntil(() => !store.loading('branch'));
    await store.resolveValues('branch', [9999]);

    // A different collection knows different values.
    expect(second.keyCalls).toEqual([[9999]]);
    expect(store.displayOf('branch', 9999)).toBe('New');
  });
});
