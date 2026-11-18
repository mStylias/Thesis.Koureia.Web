import { signal, type Signal } from '@angular/core';
import {
  deserializeForest,
  serializeForest,
  traverseForest,
  TreeNode,
  validateDetachedForest,
} from './tree-node';
import {
  TreeInvariantError,
  type TreeCloneOptions,
  type TreeKey,
  type TreeModelSnapshot,
  type TreeSerializeOptions,
  type TreeSortOptions,
  type TreeTraversalOrder,
} from './tree.types';

type NodePredicate<T, K extends TreeKey> = (node: TreeNode<T, K>) => boolean;
type NodeComparator<T, K extends TreeKey> = (left: TreeNode<T, K>, right: TreeNode<T, K>) => number;

/**
 * Owns one invisible root and its top-level visible nodes, matching Angular Aria's tree model.
 */
export class TreeModel<T, K extends TreeKey = string> {
  readonly #childrenState = signal<readonly TreeNode<T, K>[]>([]);
  readonly #sizeState = signal(0);
  readonly #nodesByKey = new Map<K, TreeNode<T, K>>();

  /** Top-level visible nodes in display order. */
  readonly children: Signal<readonly TreeNode<T, K>[]> = this.#childrenState.asReadonly();

  /** Number of visible nodes in the model. */
  readonly size: Signal<number> = this.#sizeState.asReadonly();

  constructor(children: readonly TreeNode<T, K>[] = []) {
    const roots = children.slice();
    const nodes = validateDetachedForest(roots);
    this.#childrenState.set(roots);
    for (const node of nodes) {
      this.#nodesByKey.set(node.key, node);
      node._setOwner(this);
    }
    this.#sizeState.set(this.#nodesByKey.size);
  }

  /** Appends a detached subtree at the top level and returns it. */
  append(node: TreeNode<T, K>): TreeNode<T, K> {
    return this.insert(node, this.children().length);
  }

  /** Prepends a detached subtree at the top level and returns it. */
  prepend(node: TreeNode<T, K>): TreeNode<T, K> {
    return this.insert(node, 0);
  }

  /** Inserts a detached subtree at a top-level index, or moves an owned node there. */
  insert(node: TreeNode<T, K>, index: number): TreeNode<T, K> {
    if (node._ownerModel() === this) {
      this.move(node, null, index);
      return node;
    }
    if (node._ownerModel() !== null) {
      throw new TreeInvariantError(
        'cross-tree',
        `Tree node ${String(node.key)} belongs to a different tree model. Detach it first.`,
      );
    }
    if (node.parent() !== null) {
      throw new TreeInvariantError(
        'already-attached',
        `Tree node ${String(node.key)} has a parent. Detach it before adding it to the root.`,
      );
    }

    const insertAt = assertInsertIndex(index, this.children().length);
    this._assertKeysAvailable(node);
    this._registerSubtree(node);
    const next = this.children().slice();
    next.splice(insertAt, 0, node);
    node._setParent(null);
    this.#childrenState.set(next);
    return node;
  }

  /** Removes and returns any owned subtree by identity or key. */
  remove(target: TreeNode<T, K> | K): TreeNode<T, K> | undefined {
    const node = target instanceof TreeNode ? target : this.#nodesByKey.get(target);
    if (node?._ownerModel() !== this) {
      return undefined;
    }

    const parent = node.parent();
    const collection = parent?.children() ?? this.children();
    const index = collection.indexOf(node);
    if (index < 0) {
      throw new TreeInvariantError(
        'invalid-parent',
        `Tree node ${String(node.key)} is missing from its recorded parent.`,
      );
    }
    const next = collection.slice();
    next.splice(index, 1);
    this.#replaceCollection(parent, next);
    node._setParent(null);
    this.#unregisterSubtree(node);
    return node;
  }

  /** Moves an owned node below another owned node or to the top level. */
  move(node: TreeNode<T, K>, parent: TreeNode<T, K> | null, index?: number): TreeNode<T, K> {
    if (node._ownerModel() !== this) {
      throw new TreeInvariantError(
        'cross-tree',
        `Tree node ${String(node.key)} is not owned by this tree model.`,
      );
    }
    if (parent !== null && parent._ownerModel() !== this) {
      throw new TreeInvariantError(
        'cross-tree',
        `Target parent ${String(parent.key)} is not owned by this tree model.`,
      );
    }
    if (parent === node || (parent !== null && node.contains(parent))) {
      throw new TreeInvariantError(
        'cycle',
        `Moving tree node ${String(node.key)} below ${String(parent.key)} would create a cycle.`,
      );
    }

    const sourceParent = node.parent();
    const source = sourceParent?.children() ?? this.children();
    const sourceIndex = source.indexOf(node);
    if (sourceIndex < 0) {
      throw new TreeInvariantError(
        'invalid-parent',
        `Tree node ${String(node.key)} is missing from its recorded parent.`,
      );
    }
    const target = parent?.children() ?? this.children();

    if (source === target) {
      const reordered = source.slice();
      reordered.splice(sourceIndex, 1);
      const insertAt = assertInsertIndex(index ?? reordered.length, reordered.length);
      reordered.splice(insertAt, 0, node);
      if (!sameOrder(source, reordered)) {
        this.#replaceCollection(parent, reordered);
      }
      return node;
    }

    const insertAt = assertInsertIndex(index ?? target.length, target.length);
    const sourceNext = source.slice();
    sourceNext.splice(sourceIndex, 1);
    const targetNext = target.slice();
    targetNext.splice(insertAt, 0, node);
    this.#replaceCollection(sourceParent, sourceNext);
    node._setParent(parent);
    this.#replaceCollection(parent, targetNext);
    return node;
  }

  /** Detaches every top-level subtree and returns them in their previous order. */
  clear(): readonly TreeNode<T, K>[] {
    const removed = this.children().slice();
    this.#childrenState.set([]);
    for (const node of removed) {
      node._setParent(null);
      this.#unregisterSubtree(node);
    }
    return removed;
  }

  /** Sorts top-level nodes, optionally including every descendant collection. */
  sort(comparator: NodeComparator<T, K>, options: TreeSortOptions = {}): this {
    const current = this.children();
    const sorted = current.slice().sort(comparator);
    if (!sameOrder(current, sorted)) {
      this.#childrenState.set(sorted);
    }
    if (options.recursive === true) {
      for (const node of current) {
        node.sortChildren(comparator, { recursive: true });
      }
    }
    return this;
  }

  /** Returns a node by its unique key in constant time. */
  get(key: K): TreeNode<T, K> | undefined {
    return this.#nodesByKey.get(key);
  }

  /** Returns whether this model contains a key or node identity. */
  has(value: K | TreeNode<T, K>): boolean {
    return value instanceof TreeNode ? value._ownerModel() === this : this.#nodesByKey.has(value);
  }

  /** Finds the first matching node using the requested traversal order. */
  find(
    predicate: NodePredicate<T, K>,
    order: TreeTraversalOrder = 'preorder',
  ): TreeNode<T, K> | undefined {
    for (const node of this.traverse(order)) {
      if (predicate(node)) {
        return node;
      }
    }
    return undefined;
  }

  /** Returns every matching node using the requested traversal order. */
  findAll(
    predicate: NodePredicate<T, K>,
    order: TreeTraversalOrder = 'preorder',
  ): readonly TreeNode<T, K>[] {
    const matches: TreeNode<T, K>[] = [];
    for (const node of this.traverse(order)) {
      if (predicate(node)) {
        matches.push(node);
      }
    }
    return matches;
  }

  /** Iterates over every visible node without recursive calls. */
  traverse(order: TreeTraversalOrder = 'preorder'): IterableIterator<TreeNode<T, K>> {
    return traverseForest(this.children(), order);
  }

  /** Creates a detached structural clone with an independent invisible root. */
  clone(options: TreeCloneOptions<T, K>): TreeModel<T, K> {
    return new TreeModel(this.children().map((node) => node.clone(options)));
  }

  /** Creates a plain model snapshot. */
  serialize(options: TreeSerializeOptions = {}): TreeModelSnapshot<T, K> {
    return { children: serializeForest(this.children(), options) };
  }

  /** Creates the canonical JSON snapshot, including node-owned UI state. */
  toJSON(): TreeModelSnapshot<T, K> {
    return this.serialize();
  }

  /** Reconstructs a model, parent links, signals, and the key index from a snapshot. */
  static fromJSON<T, K extends TreeKey = string>(
    snapshot: TreeModelSnapshot<T, K>,
  ): TreeModel<T, K> {
    const candidate: unknown = snapshot;
    if (!hasChildrenArray(candidate)) {
      throw new TreeInvariantError('invalid-snapshot', 'A serialized tree model needs children.');
    }
    return new TreeModel(deserializeForest(snapshot.children));
  }

  /** @internal Returns top-level children for node sibling queries. */
  _topLevelChildren(): readonly TreeNode<T, K>[] {
    return this.children();
  }

  /** @internal Ensures a detached subtree can be registered without key collisions. */
  _assertKeysAvailable(root: TreeNode<T, K>): void {
    const candidateKeys = new Set<K>();
    for (const node of root.traverse()) {
      if (candidateKeys.has(node.key) || this.#nodesByKey.has(node.key)) {
        throw new TreeInvariantError(
          'duplicate-key',
          `Tree key ${String(node.key)} must be unique.`,
        );
      }
      candidateKeys.add(node.key);
    }
  }

  /** @internal Registers a validated subtree and updates node ownership. */
  _registerSubtree(root: TreeNode<T, K>): void {
    for (const node of root.traverse()) {
      this.#nodesByKey.set(node.key, node);
      node._setOwner(this);
    }
    this.#sizeState.set(this.#nodesByKey.size);
  }

  #unregisterSubtree(root: TreeNode<T, K>): void {
    for (const node of root.traverse()) {
      this.#nodesByKey.delete(node.key);
      node._setOwner(null);
    }
    this.#sizeState.set(this.#nodesByKey.size);
  }

  #replaceCollection(parent: TreeNode<T, K> | null, nodes: readonly TreeNode<T, K>[]): void {
    if (parent === null) {
      this.#childrenState.set(nodes.slice());
      return;
    }
    parent._replaceChildren(nodes);
  }
}

function assertInsertIndex(index: number, length: number): number {
  if (!Number.isInteger(index) || index < 0 || index > length) {
    throw new RangeError(`Tree insertion index ${String(index)} is outside 0..${String(length)}.`);
  }
  return index;
}

function sameOrder<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasChildrenArray(value: unknown): value is { children: readonly unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'children' in value &&
    Array.isArray(value.children)
  );
}
