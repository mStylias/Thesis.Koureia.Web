import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import type { TreeModel } from './tree-model';
import {
  TreeInvariantError,
  type TreeCloneOptions,
  type TreeKey,
  type TreeNodeOptions,
  type TreeNodeSnapshot,
  type TreeSerializeOptions,
  type TreeSortOptions,
  type TreeTraversalOrder,
} from './tree.types';

type NodePredicate<T, K extends TreeKey> = (node: TreeNode<T, K>) => boolean;
type NodeComparator<T, K extends TreeKey> = (left: TreeNode<T, K>, right: TreeNode<T, K>) => number;

interface MutableNodeSnapshot<T, K extends TreeKey> {
  key: K;
  data: T;
  label?: string;
  expanded?: boolean;
  disabled?: boolean;
  selectable?: boolean;
  expandable?: boolean;
  children: MutableNodeSnapshot<T, K>[];
}

/** A stable, signal-backed item in a hierarchical tree model. */
export class TreeNode<T, K extends TreeKey = string> {
  readonly #parentState = signal<TreeNode<T, K> | null>(null);
  readonly #childrenState = signal<readonly TreeNode<T, K>[]>([]);
  #owner: TreeModel<T, K> | null = null;

  /** Stable identity used for lookup, Angular Aria values, and template tracking. */
  readonly key: K;

  /** Application-owned data carried by this node. */
  readonly data: WritableSignal<T>;

  /** Optional display and typeahead label. */
  readonly label: WritableSignal<string | undefined>;

  /** Whether this node's descendants should be displayed. */
  readonly expanded: WritableSignal<boolean>;

  /** Whether interaction with this node is disabled. */
  readonly disabled: WritableSignal<boolean>;

  /** Whether this node can participate in selection. */
  readonly selectable: WritableSignal<boolean>;

  /**
   * Whether this node is a branch whose children are not loaded. It keeps a
   * childless row expandable, which is what a lazy level needs before it loads.
   */
  readonly expandable: WritableSignal<boolean>;

  /** The visible parent node, or null for a top-level or detached root. */
  readonly parent: Signal<TreeNode<T, K> | null> = this.#parentState.asReadonly();

  /** Direct children in display order. Structural writes go through node methods. */
  readonly children: Signal<readonly TreeNode<T, K>[]> = this.#childrenState.asReadonly();

  /** Number of visible node ancestors. Top-level nodes have depth zero. */
  readonly depth = computed(() => {
    let value = 0;
    let current = this.parent();
    while (current !== null) {
      value += 1;
      current = current.parent();
    }
    return value;
  });

  /** Whether this node has no children and declares none to load. */
  readonly leaf = computed(() => this.children().length === 0 && !this.expandable());

  constructor(options: TreeNodeOptions<T, K>) {
    this.key = options.key;
    this.data = signal(options.data);
    this.label = signal(options.label);
    this.expanded = signal(options.expanded ?? false);
    this.disabled = signal(options.disabled ?? false);
    this.selectable = signal(options.selectable ?? true);
    this.expandable = signal(options.expandable ?? false);

    const children = options.children?.slice() ?? [];
    const childNodes = validateDetachedForest(children);
    const keys = new Set<K>([this.key]);
    for (const child of childNodes) {
      if (keys.has(child.key)) {
        throw duplicateKeyError(child.key);
      }
      keys.add(child.key);
    }
    this._initializeChildren(children);
  }

  /** Appends a detached subtree and returns it. */
  appendChild(child: TreeNode<T, K>): TreeNode<T, K> {
    return this.insertChild(child, this.children().length);
  }

  /** Prepends a detached subtree and returns it. */
  prependChild(child: TreeNode<T, K>): TreeNode<T, K> {
    return this.insertChild(child, 0);
  }

  /** Inserts a detached subtree at a specific child index. */
  insertChild(child: TreeNode<T, K>, index: number): TreeNode<T, K> {
    const insertAt = assertInsertIndex(index, this.children().length);
    if (child.parent() !== null || child._ownerModel() !== null) {
      throw new TreeInvariantError(
        'already-attached',
        `Tree node ${String(child.key)} is already attached. Use moveTo() or detach() first.`,
      );
    }
    if (child === this || child.contains(this)) {
      throw new TreeInvariantError(
        'cycle',
        `Attaching tree node ${String(child.key)} below ${String(this.key)} would create a cycle.`,
      );
    }

    const owner = this.#owner;
    if (owner !== null) {
      owner._assertKeysAvailable(child);
      owner._registerSubtree(child);
    } else {
      assertNoDuplicateKeys(this.root(), child);
    }

    child.#parentState.set(this);
    const next = this.children().slice();
    next.splice(insertAt, 0, child);
    this.#childrenState.set(next);
    return child;
  }

  /** Removes and returns a direct child, leaving its subtree intact. */
  removeChild(target: TreeNode<T, K> | K): TreeNode<T, K> | undefined {
    const child = this.#resolveDirectChild(target);
    if (child === undefined) {
      return undefined;
    }
    if (this.#owner !== null) {
      return this.#owner.remove(child);
    }
    this.#removeDetachedChild(child);
    return child;
  }

  /** Detaches this node and its descendants from their current parent or model. */
  detach(): this {
    if (this.#owner !== null) {
      this.#owner.remove(this);
      return this;
    }
    const currentParent = this.parent();
    if (currentParent !== null) {
      currentParent.#removeDetachedChild(this);
    }
    return this;
  }

  /** Moves this subtree below a new parent, or to the model's top level with null. */
  moveTo(parent: TreeNode<T, K> | null, index?: number): this {
    if (this.#owner !== null) {
      this.#owner.move(this, parent, index);
      return this;
    }

    if (parent === null) {
      if (index !== undefined) {
        assertInsertIndex(index, 0);
      }
      return this.detach();
    }
    if (parent === this || this.contains(parent)) {
      throw new TreeInvariantError(
        'cycle',
        `Moving tree node ${String(this.key)} below ${String(parent.key)} would create a cycle.`,
      );
    }

    const currentParent = this.parent();
    if (currentParent === parent) {
      parent.#moveExistingChild(this, index);
      return this;
    }

    const insertAt = assertInsertIndex(index ?? parent.children().length, parent.children().length);
    const targetOwner = parent._ownerModel();
    if (targetOwner !== null) {
      targetOwner._assertKeysAvailable(this);
    } else if (this.root() !== parent.root()) {
      assertNoDuplicateKeys(parent.root(), this);
    }

    this.detach();
    parent.insertChild(this, insertAt);
    return this;
  }

  /** Sorts this node's children, optionally including every descendant collection. */
  sortChildren(comparator: NodeComparator<T, K>, options: TreeSortOptions = {}): this {
    const pending: TreeNode<T, K>[] = [this];
    while (pending.length > 0) {
      const node = pending.pop();
      if (node === undefined) {
        break;
      }
      const current = node.children();
      const sorted = current.slice().sort(comparator);
      if (!sameOrder(current, sorted)) {
        node.#childrenState.set(sorted);
      }
      if (options.recursive === true) {
        for (let childIndex = current.length - 1; childIndex >= 0; childIndex -= 1) {
          pending.push(current[childIndex]);
        }
      }
    }
    return this;
  }

  /** Returns whether this subtree contains the supplied node by identity. */
  contains(candidate: TreeNode<T, K>): boolean {
    return this.find((node) => node === candidate) !== undefined;
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

  /** Iterates over this node and its descendants without recursive calls. */
  traverse(order: TreeTraversalOrder = 'preorder'): IterableIterator<TreeNode<T, K>> {
    return traverseForest([this], order);
  }

  /** Returns ancestors nearest-first. */
  ancestors(): readonly TreeNode<T, K>[] {
    const result: TreeNode<T, K>[] = [];
    let current = this.parent();
    while (current !== null) {
      result.push(current);
      current = current.parent();
    }
    return result;
  }

  /** Returns descendants in the requested order, excluding this node. */
  descendants(order: TreeTraversalOrder = 'preorder'): readonly TreeNode<T, K>[] {
    const result: TreeNode<T, K>[] = [];
    for (const node of this.traverse(order)) {
      if (node !== this) {
        result.push(node);
      }
    }
    return result;
  }

  /** Returns siblings in display order, excluding this node. */
  siblings(): readonly TreeNode<T, K>[] {
    const parent = this.parent();
    const collection = parent?.children() ?? this.#owner?._topLevelChildren() ?? [this];
    return collection.filter((node) => node !== this);
  }

  /** Returns the path from the top-level visible node to this node. */
  path(): readonly TreeNode<T, K>[] {
    const path = this.ancestors().slice().reverse();
    path.push(this);
    return path;
  }

  /** Returns the top-most visible node in this subtree chain. */
  root(): TreeNode<T, K> {
    const ancestors = this.ancestors();
    return ancestors.length === 0 ? this : ancestors[ancestors.length - 1];
  }

  /** Creates a detached deep structural clone using caller-supplied keys. */
  clone(options: TreeCloneOptions<T, K>): TreeNode<T, K> {
    const includeUiState = options.includeUiState ?? true;
    const sources = Array.from(this.traverse());
    const clones = new Map<TreeNode<T, K>, TreeNode<T, K>>();
    const keys = new Set<K>();

    for (const source of sources) {
      const key = options.key(source);
      if (keys.has(key)) {
        throw duplicateKeyError(key);
      }
      keys.add(key);
      const data = options.data === undefined ? source.data() : options.data(source.data(), source);
      clones.set(
        source,
        new TreeNode({
          key,
          data,
          label: source.label(),
          expanded: includeUiState ? source.expanded() : false,
          disabled: includeUiState ? source.disabled() : false,
          selectable: includeUiState ? source.selectable() : true,
          expandable: source.expandable(),
        }),
      );
    }

    for (const source of sources) {
      const clone = requiredMapValue(clones, source);
      clone._initializeChildren(source.children().map((child) => requiredMapValue(clones, child)));
    }
    return requiredMapValue(clones, this);
  }

  /** Creates a plain subtree snapshot. */
  serialize(options: TreeSerializeOptions = {}): TreeNodeSnapshot<T, K> {
    return serializeForest([this], options)[0];
  }

  /** Creates the canonical JSON snapshot, including node-owned UI state. */
  toJSON(): TreeNodeSnapshot<T, K> {
    return this.serialize();
  }

  /** Reconstructs a detached subtree from a plain snapshot. */
  static fromJSON<T, K extends TreeKey = string>(snapshot: TreeNodeSnapshot<T, K>): TreeNode<T, K> {
    return deserializeForest([snapshot])[0];
  }

  /** @internal Returns the model that currently owns this node. */
  _ownerModel(): TreeModel<T, K> | null {
    return this.#owner;
  }

  /** @internal Updates model ownership during an atomic structural operation. */
  _setOwner(owner: TreeModel<T, K> | null): void {
    this.#owner = owner;
  }

  /** @internal Replaces children after a deserializer has validated the whole snapshot. */
  _initializeChildren(children: readonly TreeNode<T, K>[]): void {
    if (this.children().length > 0 && children.length > 0) {
      throw new TreeInvariantError(
        'invalid-parent',
        `Tree node ${String(this.key)} already has initialized children.`,
      );
    }
    for (const child of children) {
      child.#parentState.set(this);
    }
    this.#childrenState.set(children.slice());
  }

  /** @internal Replaces the direct child collection after model-level validation. */
  _replaceChildren(children: readonly TreeNode<T, K>[]): void {
    this.#childrenState.set(children.slice());
  }

  /** @internal Updates the visible parent after model-level validation. */
  _setParent(parent: TreeNode<T, K> | null): void {
    this.#parentState.set(parent);
  }

  #resolveDirectChild(target: TreeNode<T, K> | K): TreeNode<T, K> | undefined {
    if (target instanceof TreeNode) {
      return this.children().find((child) => child === target);
    }
    return this.children().find((child) => child.key === target);
  }

  #removeDetachedChild(child: TreeNode<T, K>): void {
    const current = this.children();
    const index = current.indexOf(child);
    if (index < 0) {
      throw new TreeInvariantError(
        'invalid-parent',
        `Tree node ${String(child.key)} is not a child of ${String(this.key)}.`,
      );
    }
    const next = current.slice();
    next.splice(index, 1);
    this.#childrenState.set(next);
    child.#parentState.set(null);
  }

  #moveExistingChild(child: TreeNode<T, K>, index?: number): void {
    const current = this.children();
    const currentIndex = current.indexOf(child);
    if (currentIndex < 0) {
      throw new TreeInvariantError(
        'invalid-parent',
        `Tree node ${String(child.key)} is not a child of ${String(this.key)}.`,
      );
    }
    const next = current.slice();
    next.splice(currentIndex, 1);
    const insertAt = assertInsertIndex(index ?? next.length, next.length);
    next.splice(insertAt, 0, child);
    if (!sameOrder(current, next)) {
      this.#childrenState.set(next);
    }
  }
}

/** @internal Iterates over one or more roots without recursive calls. */
export function* traverseForest<T, K extends TreeKey>(
  roots: readonly TreeNode<T, K>[],
  order: TreeTraversalOrder = 'preorder',
): IterableIterator<TreeNode<T, K>> {
  if (order === 'breadth-first') {
    const queue = roots.slice();
    let index = 0;
    while (index < queue.length) {
      const node = queue[index];
      index += 1;
      yield node;
      queue.push(...node.children());
    }
    return;
  }

  const stack = roots
    .slice()
    .reverse()
    .map((node) => ({ node, visited: false }));
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) {
      break;
    }
    if (order === 'postorder' && !entry.visited) {
      stack.push({ node: entry.node, visited: true });
      const children = entry.node.children();
      for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
        stack.push({ node: children[childIndex], visited: false });
      }
      continue;
    }

    yield entry.node;
    if (order === 'preorder') {
      const children = entry.node.children();
      for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
        stack.push({ node: children[childIndex], visited: false });
      }
    }
  }
}

/** @internal Validates detached roots and returns all nodes in preorder. */
export function validateDetachedForest<T, K extends TreeKey>(
  roots: readonly TreeNode<T, K>[],
): readonly TreeNode<T, K>[] {
  const nodes: TreeNode<T, K>[] = [];
  const identities = new Set<TreeNode<T, K>>();
  const keys = new Set<K>();
  const pending = roots
    .slice()
    .reverse()
    .map((node) => ({ node, expectedParent: null as TreeNode<T, K> | null }));

  while (pending.length > 0) {
    const entry = pending.pop();
    if (entry === undefined) {
      break;
    }
    if (identities.has(entry.node)) {
      throw new TreeInvariantError('cycle', 'The supplied nodes contain a cycle or shared child.');
    }
    if (entry.node.parent() !== entry.expectedParent) {
      throw new TreeInvariantError(
        'invalid-parent',
        `Tree node ${String(entry.node.key)} has an inconsistent parent reference.`,
      );
    }
    if (entry.node._ownerModel() !== null) {
      throw new TreeInvariantError(
        'already-attached',
        `Tree node ${String(entry.node.key)} already belongs to a tree model.`,
      );
    }
    if (keys.has(entry.node.key)) {
      throw duplicateKeyError(entry.node.key);
    }

    identities.add(entry.node);
    keys.add(entry.node.key);
    nodes.push(entry.node);
    const children = entry.node.children();
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      pending.push({ node: children[childIndex], expectedParent: entry.node });
    }
  }
  return nodes;
}

/** @internal Serializes one or more visible roots. */
export function serializeForest<T, K extends TreeKey>(
  roots: readonly TreeNode<T, K>[],
  options: TreeSerializeOptions = {},
): readonly TreeNodeSnapshot<T, K>[] {
  const includeUiState = options.includeUiState ?? true;
  const snapshots = roots.map((node) => createSnapshot(node, includeUiState));
  const pending = roots.map((node, index) => ({ node, snapshot: snapshots[index] }));

  while (pending.length > 0) {
    const entry = pending.pop();
    if (entry === undefined) {
      break;
    }
    for (const child of entry.node.children()) {
      const childSnapshot = createSnapshot(child, includeUiState);
      entry.snapshot.children.push(childSnapshot);
      pending.push({ node: child, snapshot: childSnapshot });
    }
  }
  return snapshots;
}

/** @internal Reconstructs and validates one or more visible roots. */
export function deserializeForest<T, K extends TreeKey>(
  snapshots: readonly TreeNodeSnapshot<T, K>[],
): readonly TreeNode<T, K>[] {
  const seen = new Set<object>();
  const keys = new Set<K>();
  const records: { snapshot: TreeNodeSnapshot<T, K>; node: TreeNode<T, K> }[] = [];
  const nodes = new Map<TreeNodeSnapshot<T, K>, TreeNode<T, K>>();
  const pending = snapshots.slice().reverse();

  while (pending.length > 0) {
    const snapshot = pending.pop();
    if (snapshot === undefined) {
      break;
    }
    validateSnapshot(snapshot);
    if (seen.has(snapshot)) {
      throw new TreeInvariantError(
        'invalid-snapshot',
        'A serialized tree node cannot appear more than once.',
      );
    }
    seen.add(snapshot);
    if (keys.has(snapshot.key)) {
      throw duplicateKeyError(snapshot.key);
    }
    keys.add(snapshot.key);

    const node = new TreeNode<T, K>({
      key: snapshot.key,
      data: snapshot.data,
      label: snapshot.label,
      expanded: snapshot.expanded ?? false,
      disabled: snapshot.disabled ?? false,
      selectable: snapshot.selectable ?? true,
      expandable: snapshot.expandable ?? false,
    });
    records.push({ snapshot, node });
    nodes.set(snapshot, node);
    for (let childIndex = snapshot.children.length - 1; childIndex >= 0; childIndex -= 1) {
      pending.push(snapshot.children[childIndex]);
    }
  }

  for (const record of records) {
    record.node._initializeChildren(
      record.snapshot.children.map((child) => requiredMapValue(nodes, child)),
    );
  }
  return snapshots.map((snapshot) => requiredMapValue(nodes, snapshot));
}

function createSnapshot<T, K extends TreeKey>(
  node: TreeNode<T, K>,
  includeUiState: boolean,
): MutableNodeSnapshot<T, K> {
  const snapshot: MutableNodeSnapshot<T, K> = {
    key: node.key,
    data: node.data(),
    children: [],
  };
  const label = node.label();
  if (label !== undefined) {
    snapshot.label = label;
  }
  // Structure, not UI state: an unloaded branch stays a branch in a snapshot.
  if (node.expandable()) {
    snapshot.expandable = true;
  }
  if (includeUiState) {
    snapshot.expanded = node.expanded();
    snapshot.disabled = node.disabled();
    snapshot.selectable = node.selectable();
  }
  return snapshot;
}

function validateSnapshot<T, K extends TreeKey>(snapshot: TreeNodeSnapshot<T, K>): void {
  const candidate: unknown = snapshot;
  if (!hasChildrenArray(candidate)) {
    throw new TreeInvariantError('invalid-snapshot', 'Every serialized tree node needs children.');
  }
  if (typeof snapshot.key !== 'string' && typeof snapshot.key !== 'number') {
    throw new TreeInvariantError('invalid-snapshot', 'Tree node keys must be strings or numbers.');
  }
  if (snapshot.label !== undefined && typeof snapshot.label !== 'string') {
    throw new TreeInvariantError(
      'invalid-snapshot',
      'Tree node labels must be strings when present.',
    );
  }
  for (const state of [
    snapshot.expanded,
    snapshot.disabled,
    snapshot.selectable,
    snapshot.expandable,
  ]) {
    if (state !== undefined && typeof state !== 'boolean') {
      throw new TreeInvariantError('invalid-snapshot', 'Tree node UI state must be boolean.');
    }
  }
}

function assertNoDuplicateKeys<T, K extends TreeKey>(
  existingRoot: TreeNode<T, K>,
  candidateRoot: TreeNode<T, K>,
): void {
  const existing = new Set(Array.from(existingRoot.traverse(), (node) => node.key));
  for (const node of candidateRoot.traverse()) {
    if (existing.has(node.key)) {
      throw duplicateKeyError(node.key);
    }
  }
}

function duplicateKeyError(key: TreeKey): TreeInvariantError {
  return new TreeInvariantError('duplicate-key', `Tree key ${String(key)} must be unique.`);
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

function requiredMapValue<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new TreeInvariantError(
      'invalid-snapshot',
      'The tree snapshot is internally inconsistent.',
    );
  }
  return value;
}

function hasChildrenArray(value: unknown): value is { children: readonly unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'children' in value &&
    Array.isArray(value.children)
  );
}
