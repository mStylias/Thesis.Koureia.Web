import { TreeModel } from './tree-model';
import { TreeNode } from './tree-node';
import { TreeInvariantError, type TreeNodeSnapshot } from './tree.types';

interface TestData {
  name: string;
  rank: number;
}

function createNode(
  key: string,
  rank = 0,
  children: readonly TreeNode<TestData>[] = [],
): TreeNode<TestData> {
  return new TreeNode({ key, data: { name: key, rank }, label: key, children });
}

function traversalKeys(nodes: Iterable<TreeNode<TestData>>): string[] {
  return Array.from(nodes, (node) => node.key);
}

describe('TreeNode', () => {
  it('exposes signal-backed data and UI state with safe defaults', () => {
    const node = createNode('root');

    expect(node.data()).toEqual({ name: 'root', rank: 0 });
    expect(node.label()).toBe('root');
    expect(node.expanded()).toBe(false);
    expect(node.disabled()).toBe(false);
    expect(node.selectable()).toBe(true);
    expect(node.parent()).toBeNull();
    expect(node.children()).toEqual([]);
    expect(node.depth()).toBe(0);
    expect(node.leaf()).toBe(true);

    node.data.set({ name: 'renamed', rank: 1 });
    node.expanded.set(true);
    node.disabled.set(true);
    node.selectable.set(false);

    expect(node.data().name).toBe('renamed');
    expect(node.expanded()).toBe(true);
    expect(node.disabled()).toBe(true);
    expect(node.selectable()).toBe(false);
  });

  it('replaces child arrays and maintains parent-derived state', () => {
    const parent = createNode('parent');
    const child = createNode('child');
    const previousChildren = parent.children();

    parent.appendChild(child);

    expect(parent.children()).not.toBe(previousChildren);
    expect(parent.children()).toEqual([child]);
    expect(parent.leaf()).toBe(false);
    expect(child.parent()).toBe(parent);
    expect(child.depth()).toBe(1);

    expect(parent.removeChild('child')).toBe(child);
    expect(parent.children()).toEqual([]);
    expect(parent.leaf()).toBe(true);
    expect(child.parent()).toBeNull();
    expect(child.depth()).toBe(0);
  });

  it('supports constructor children while preserving their subtrees', () => {
    const grandchild = createNode('grandchild');
    const child = createNode('child', 0, [grandchild]);
    const root = createNode('root', 0, [child]);

    expect(child.parent()).toBe(root);
    expect(grandchild.parent()).toBe(child);
    expect(grandchild.root()).toBe(root);
    expect(grandchild.depth()).toBe(2);
  });

  it('rejects duplicate keys, shared parents, and cycles', () => {
    expect(() => createNode('root', 0, [createNode('same'), createNode('same')])).toThrow(
      expect.objectContaining({ code: 'duplicate-key' }),
    );

    const firstParent = createNode('first');
    const secondParent = createNode('second');
    const child = createNode('child');
    firstParent.appendChild(child);

    expect(() => secondParent.appendChild(child)).toThrow(
      expect.objectContaining({ code: 'already-attached' }),
    );
    expect(() => firstParent.moveTo(child)).toThrow(expect.objectContaining({ code: 'cycle' }));
  });

  it('moves detached nodes between parents and reorders siblings', () => {
    const first = createNode('first');
    const second = createNode('second');
    const a = createNode('a');
    const b = createNode('b');
    const c = createNode('c');
    first.appendChild(a);
    first.appendChild(b);
    first.appendChild(c);

    c.moveTo(first, 0);
    expect(traversalKeys(first.children())).toEqual(['c', 'a', 'b']);

    a.moveTo(second);
    expect(traversalKeys(first.children())).toEqual(['c', 'b']);
    expect(second.children()).toEqual([a]);
    expect(a.parent()).toBe(second);
  });

  it('supports preorder, postorder, and breadth-first traversal', () => {
    const d = createNode('d');
    const b = createNode('b', 0, [d]);
    const c = createNode('c');
    const a = createNode('a', 0, [b, c]);

    expect(traversalKeys(a.traverse())).toEqual(['a', 'b', 'd', 'c']);
    expect(traversalKeys(a.traverse('postorder'))).toEqual(['d', 'b', 'c', 'a']);
    expect(traversalKeys(a.traverse('breadth-first'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('supports scoped search and relationship queries', () => {
    const a = createNode('a', 2);
    const b = createNode('b', 1);
    const c = createNode('c', 2);
    const parent = createNode('parent', 0, [a, b, c]);
    const root = createNode('root', 0, [parent]);

    expect(root.find((node) => node.data().rank === 1)).toBe(b);
    expect(traversalKeys(root.findAll((node) => node.data().rank === 2))).toEqual(['a', 'c']);
    expect(b.ancestors()).toEqual([parent, root]);
    expect(b.path()).toEqual([root, parent, b]);
    expect(b.siblings()).toEqual([a, c]);
    expect(traversalKeys(parent.descendants())).toEqual(['a', 'b', 'c']);
  });

  it('sorts direct or recursive child collections', () => {
    const compare = (left: TreeNode<TestData>, right: TreeNode<TestData>) =>
      left.data().rank - right.data().rank;
    const nested = createNode('nested', 0, [createNode('n3', 3), createNode('n1', 1)]);
    const root = createNode('root', 0, [createNode('three', 3), nested, createNode('one', 1)]);

    root.sortChildren(compare);
    expect(traversalKeys(root.children())).toEqual(['nested', 'one', 'three']);
    expect(traversalKeys(nested.children())).toEqual(['n3', 'n1']);

    root.sortChildren(compare, { recursive: true });
    expect(traversalKeys(nested.children())).toEqual(['n1', 'n3']);
  });

  it('clones structure with new keys and configurable data and UI state', () => {
    const child = createNode('child');
    const root = createNode('root', 0, [child]);
    root.expanded.set(true);
    child.disabled.set(true);
    child.selectable.set(false);

    const clone = root.clone({
      key: (node) => `copy-${node.key}`,
      data: (data) => ({ ...data }),
    });

    expect(traversalKeys(clone.traverse())).toEqual(['copy-root', 'copy-child']);
    expect(clone.data()).not.toBe(root.data());
    expect(clone.expanded()).toBe(true);
    expect(clone.children()[0].disabled()).toBe(true);
    expect(clone.children()[0].selectable()).toBe(false);
    expect(clone.parent()).toBeNull();

    const resetClone = root.clone({
      key: (node) => `reset-${node.key}`,
      includeUiState: false,
    });
    expect(resetClone.expanded()).toBe(false);
    expect(resetClone.children()[0].disabled()).toBe(false);
    expect(resetClone.children()[0].selectable()).toBe(true);
  });

  it('serializes and restores a subtree with optional UI state', () => {
    const child = createNode('child');
    const root = createNode('root', 0, [child]);
    root.expanded.set(true);
    child.disabled.set(true);

    const restored = TreeNode.fromJSON(
      JSON.parse(JSON.stringify(root)) as TreeNodeSnapshot<TestData>,
    );

    expect(traversalKeys(restored.traverse())).toEqual(['root', 'child']);
    expect(restored.expanded()).toBe(true);
    expect(restored.children()[0].disabled()).toBe(true);
    expect(restored.children()[0].parent()).toBe(restored);

    const withoutState = root.serialize({ includeUiState: false });
    expect(withoutState).not.toHaveProperty('expanded');
    expect(withoutState.children[0]).not.toHaveProperty('disabled');
  });

  it('rejects duplicate keys produced by a clone key factory', () => {
    const root = createNode('root', 0, [createNode('child')]);

    expect(() => root.clone({ key: () => 'same' })).toThrow(
      expect.objectContaining({ code: 'duplicate-key' }),
    );
  });
});

describe('TreeNode expandable branches', () => {
  it('keeps a childless node a branch while it declares unloaded children', () => {
    const node = new TreeNode<TestData>({
      key: 'lazy',
      data: { name: 'lazy', rank: 0 },
      expandable: true,
    });

    expect(node.children()).toEqual([]);
    expect(node.leaf()).toBe(false);

    node.expandable.set(false);

    expect(node.leaf()).toBe(true);
  });

  it('round-trips the flag through snapshots and clones as structure', () => {
    const node = new TreeNode<TestData>({
      key: 'lazy',
      data: { name: 'lazy', rank: 0 },
      expandable: true,
    });

    expect(node.serialize().expandable).toBe(true);
    // Structure, not UI state: it survives a state-free snapshot.
    expect(node.serialize({ includeUiState: false }).expandable).toBe(true);
    expect(createNode('loaded').serialize().expandable).toBeUndefined();

    expect(TreeNode.fromJSON(node.toJSON()).leaf()).toBe(false);
    expect(node.clone({ key: (source) => `${source.key}-copy` }).expandable()).toBe(true);
  });
});

describe('TreeModel', () => {
  it('owns an invisible root with indexed top-level subtrees', () => {
    const child = createNode('child');
    const root = createNode('root', 0, [child]);
    const second = createNode('second');
    const model = new TreeModel([root, second]);

    expect(model.children()).toEqual([root, second]);
    expect(model.size()).toBe(3);
    expect(model.get('child')).toBe(child);
    expect(model.has(root)).toBe(true);
    expect(model.has('missing')).toBe(false);
    expect(root.parent()).toBeNull();
    expect(root.siblings()).toEqual([second]);
  });

  it('rejects duplicate and cross-model attachments', () => {
    const model = new TreeModel([createNode('existing')]);
    const duplicate = createNode('branch', 0, [createNode('existing')]);

    expect(() => model.append(duplicate)).toThrow(
      expect.objectContaining({ code: 'duplicate-key' }),
    );

    const otherModel = new TreeModel([createNode('other')]);
    const other = otherModel.get('other');
    if (other === undefined) {
      throw new Error('Expected the other model node to exist.');
    }
    expect(() => model.append(other)).toThrow(expect.objectContaining({ code: 'cross-tree' }));
  });

  it('detaches, reattaches, and moves entire subtrees', () => {
    const child = createNode('child');
    const first = createNode('first', 0, [child]);
    const second = createNode('second');
    const model = new TreeModel([first, second]);

    model.move(child, second);
    expect(first.children()).toEqual([]);
    expect(second.children()).toEqual([child]);
    expect(child.parent()).toBe(second);

    child.moveTo(null, 0);
    expect(model.children()).toEqual([child, first, second]);
    expect(child.parent()).toBeNull();

    expect(model.remove('second')).toBe(second);
    expect(model.size()).toBe(2);
    expect(second.children()).toEqual([]);
    expect(second.parent()).toBeNull();

    model.append(second);
    expect(model.size()).toBe(3);
    expect(model.get('second')).toBe(second);
  });

  it('returns detached subtrees when clearing the model', () => {
    const first = createNode('first', 0, [createNode('child')]);
    const second = createNode('second');
    const model = new TreeModel([first, second]);

    expect(model.clear()).toEqual([first, second]);
    expect(model.children()).toEqual([]);
    expect(model.size()).toBe(0);
    expect(model.has(first)).toBe(false);
    expect(first.children()[0].parent()).toBe(first);
  });

  it('searches, traverses, and recursively sorts the entire model', () => {
    const compare = (left: TreeNode<TestData>, right: TreeNode<TestData>) =>
      left.data().rank - right.data().rank;
    const high = createNode('high', 3, [createNode('nested-high', 4), createNode('nested-low', 1)]);
    const low = createNode('low', 1);
    const model = new TreeModel([high, low]);

    expect(model.find((node) => node.key === 'nested-low')?.key).toBe('nested-low');
    expect(model.findAll((node) => node.data().rank > 2)).toEqual([high, high.children()[0]]);
    expect(traversalKeys(model.traverse('breadth-first'))).toEqual([
      'high',
      'low',
      'nested-high',
      'nested-low',
    ]);

    model.sort(compare, { recursive: true });
    expect(traversalKeys(model.children())).toEqual(['low', 'high']);
    expect(traversalKeys(high.children())).toEqual(['nested-low', 'nested-high']);
  });

  it('round-trips snapshots and rebuilds ownership and the key index', () => {
    const child = createNode('child');
    const root = createNode('root', 0, [child]);
    root.expanded.set(true);
    const model = new TreeModel([root]);

    const restored = TreeModel.fromJSON(
      JSON.parse(JSON.stringify(model)) as { children: TreeNodeSnapshot<TestData>[] },
    );
    const restoredRoot = restored.get('root');
    const restoredChild = restored.get('child');

    expect(restored.size()).toBe(2);
    expect(restoredRoot?.expanded()).toBe(true);
    expect(restoredChild?.parent()).toBe(restoredRoot);
    expect(restored.has('child')).toBe(true);
  });

  it('rejects repeated snapshot objects and duplicate serialized keys', () => {
    const shared: TreeNodeSnapshot<TestData> = {
      key: 'shared',
      data: { name: 'shared', rank: 0 },
      children: [],
    };
    expect(() => TreeModel.fromJSON({ children: [shared, shared] })).toThrow(
      expect.objectContaining({ code: 'invalid-snapshot' }),
    );

    const duplicate: TreeNodeSnapshot<TestData> = {
      key: 'same',
      data: { name: 'duplicate', rank: 0 },
      children: [],
    };
    expect(() =>
      TreeModel.fromJSON({
        children: [{ key: 'same', data: { name: 'same', rank: 0 }, children: [] }, duplicate],
      }),
    ).toThrow(expect.objectContaining({ code: 'duplicate-key' }));
  });

  it('handles deeply nested snapshots without recursive traversal', () => {
    const depth = 2_000;
    const root: TreeNodeSnapshot<TestData, number> = {
      key: 0,
      data: { name: '0', rank: 0 },
      children: [],
    };
    let current = root;
    for (let index = 1; index < depth; index += 1) {
      const child: TreeNodeSnapshot<TestData, number> = {
        key: index,
        data: { name: String(index), rank: index },
        children: [],
      };
      (current.children as TreeNodeSnapshot<TestData, number>[]).push(child);
      current = child;
    }

    const model = TreeModel.fromJSON({ children: [root] });

    expect(model.size()).toBe(depth);
    expect(Array.from(model.traverse()).length).toBe(depth);
    expect(model.get(depth - 1)?.depth()).toBe(depth - 1);
  });

  it('uses the custom invariant error type', () => {
    const model = new TreeModel([createNode('one')]);

    try {
      model.append(createNode('one'));
      throw new Error('Expected a duplicate-key error.');
    } catch (error) {
      expect(error).toBeInstanceOf(TreeInvariantError);
      expect((error as TreeInvariantError).code).toBe('duplicate-key');
    }
  });
});
