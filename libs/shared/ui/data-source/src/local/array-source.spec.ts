import { createArraySource } from './array-source';

interface Node {
  id: number;
  parentId: number | null;
  name: string;
}

const NODES: readonly Node[] = [
  { id: 1, parentId: null, name: 'Αθήνα' },
  { id: 2, parentId: 1, name: 'Κολωνάκι' },
  { id: 3, parentId: 1, name: 'Εξάρχεια' },
  { id: 4, parentId: null, name: 'Θεσσαλονίκη' },
];

describe('createArraySource', () => {
  it('serves a filter, a sort and a page through one load', async () => {
    const source = createArraySource(NODES);
    const result = await source.load({
      filter: { field: 'parentId', op: 'eq', value: 1 },
      sort: [{ field: 'name' }],
      take: 1,
      requireTotalCount: true,
    });
    expect(result.rows.map((node) => node.id)).toEqual([3]);
    expect(result.totalCount).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  it('reads the collection through a function, so a replaced array is seen', async () => {
    let rows: readonly Node[] = NODES;
    const source = createArraySource(() => rows);
    expect((await source.load({})).rows).toHaveLength(4);
    rows = NODES.slice(0, 1);
    expect((await source.load({})).rows).toHaveLength(1);
  });

  it('declares byKeys only when a key is declared', async () => {
    expect(typeof createArraySource(NODES).byKeys).toBe('undefined');

    const keyed = createArraySource(NODES, { key: 'id' });
    expect(typeof keyed.byKeys).toBe('function');
    const found = await keyed.byKeys?.([3, 1]);
    expect(found?.map((node) => node.id)).toEqual([1, 3]);
  });

  it('resolves a composite key through its serialized form', async () => {
    const source = createArraySource(NODES, { key: ['id', 'parentId'] });
    const found = await source.byKeys?.(['[2,1]']);
    expect(found?.map((node) => node.id)).toEqual([2]);
  });

  it('declares loadChildren only when a parent field is declared', async () => {
    // Absent by default, and deliberately so: @ui/tree reads a source without
    // loadChildren once and nests it in memory, which is the right shape for
    // an array. Declaring parentKey is what opts into the lazy path.
    expect(typeof createArraySource(NODES, { key: 'id' }).loadChildren).toBe('undefined');

    const lazy = createArraySource(NODES, { key: 'id', parentKey: 'parentId' });
    const roots = await lazy.loadChildren?.(null);
    expect(roots?.rows.map((node) => node.id)).toEqual([1, 4]);
    const children = await lazy.loadChildren?.(1);
    expect(children?.rows.map((node) => node.id)).toEqual([2, 3]);
    const leaves = await lazy.loadChildren?.(2);
    expect(leaves?.rows).toEqual([]);
  });

  it('applies a request to one level', async () => {
    const lazy = createArraySource(NODES, { key: 'id', parentKey: 'parentId' });
    const level = await lazy.loadChildren?.(1, { sort: [{ field: 'name', desc: true }], take: 1 });
    expect(level?.rows.map((node) => node.id)).toEqual([2]);
    expect(level?.hasMore).toBe(true);
  });

  it('folds accents in a search, so a local list matches a normalized column', async () => {
    const source = createArraySource(NODES, { searchText: (node) => node.name });
    const result = await source.load({ search: 'κολωνακι' });
    expect(result.rows.map((node) => node.id)).toEqual([2]);
  });

  it('rejects an already aborted request rather than answering it', async () => {
    const source = createArraySource(NODES, { key: 'id', parentKey: 'parentId' });
    const controller = new AbortController();
    controller.abort();

    await expect(source.load({ signal: controller.signal })).rejects.toThrow();
    await expect(source.byKeys?.([1], controller.signal)).rejects.toThrow();
    await expect(source.loadChildren?.(null, { signal: controller.signal })).rejects.toThrow();
  });
});
