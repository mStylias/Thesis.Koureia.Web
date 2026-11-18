import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  PendingTasks,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  createArraySource,
  createKeyGetter,
  isDataSource,
  throwIfAborted,
  withAbort,
  type DataInput,
  type DataKey,
  type DataSource,
  type KeySpec,
  type LoadRequest,
  type LoadResult,
} from '@ui/data-source';
import { TreeModel } from './tree-model';
import { TreeNode } from './tree-node';
import type { TreeKey } from './tree.types';

/** Reads the parent key of a flat item. A dot path, or a function. */
export type TreeParentSelector<T> = string | ((item: T) => DataKey | null | undefined);

/** Why a selected key has no node to display. */
export type TreeResolutionReason = 'notFound' | 'unsupported' | 'loadFailed';

/** Selected keys the source could not place in the tree. */
export interface TreeResolutionFailure<K extends TreeKey = string> {
  readonly keys: readonly K[];
  readonly reason: TreeResolutionReason;
  readonly cause?: unknown;
}

/** A level the source refused to load. `parent` is `null` for the root level. */
export interface TreeLoadFailure<T, K extends TreeKey = string> {
  readonly parent: TreeNode<T, K> | null;
  readonly cause: unknown;
}

/** What the loader reads from the control it serves. Every member is a signal getter. */
export interface TreeNodeSourceConfig<T, K extends TreeKey = string> {
  /** Local items or a remote source. `undefined` keeps the loader idle. */
  readonly source: () => DataInput<T> | undefined;
  /** Item identity. Required as soon as a source is bound. */
  readonly key: () => KeySpec<T> | undefined;
  /** Row text. Falls back to `String(item)`. */
  readonly displayWith: () => ((item: T) => string) | undefined;
  /** Whether an item is a branch. Only a lazy source consults it. */
  readonly hasChildren: () => ((item: T) => boolean) | undefined;
  /** Parent identity, which is what nests a flat collection. */
  readonly parentKey: () => TreeParentSelector<T> | undefined;
  /** Per-item disabled rule. */
  readonly nodeDisabled: () => ((item: T) => boolean) | undefined;
  /** Keys the control has to display right now, whether or not they are loaded. */
  readonly keys: () => readonly K[];
  /** Called once per failed resolution, so the control can report it. */
  readonly onFailure?: (failure: TreeResolutionFailure<K>) => void;
  /** Called once per rejected level load. */
  readonly onLoadError?: (failure: TreeLoadFailure<T, K>) => void;
}

/** Bounds the walk up a broken or self-referencing parent chain. */
const MAX_ANCESTOR_HOPS = 32;

function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, value);
}

/**
 * Builds and maintains the `TreeModel` of a `lib-tree` bound to a `DataSource`.
 * Construct it in a field initializer: it takes its own `Injector` and
 * `DestroyRef` from the surrounding injection context.
 *
 * A source that implements `loadChildren` is loaded one level at a time, on
 * expansion. A source that implements only `load` is read once and nested
 * through `parentKey`. The control owns the abort, never the source.
 */
export class TreeNodeSource<T, K extends TreeKey = string> {
  private readonly config: TreeNodeSourceConfig<T, K>;

  /** The model built from the source. Empty while nothing is bound. */
  readonly model = signal(new TreeModel<T, K>());
  /** The root level is in flight. */
  readonly loading = signal(false);
  /** The root level rejected. */
  readonly error = signal<unknown>(null);
  /** A lookup for a selected key is in flight. */
  readonly resolving = signal(false);
  /** Selected keys with no node to display, and why. */
  readonly failure = signal<TreeResolutionFailure<K> | null>(null);

  private readonly childLoading = signal<ReadonlySet<K>>(new Set());
  private readonly childErrors = signal<ReadonlySet<K>>(new Set());

  private readonly pendingTasks = inject(PendingTasks);
  private readonly dataSource = computed<DataSource<T> | undefined>(() => {
    const input = this.config.source();
    if (input === undefined) {
      return undefined;
    }
    return isDataSource(input) ? input : createArraySource(input);
  });
  private readonly keyGetter = computed(() => {
    const spec = this.config.key();
    return spec === undefined ? undefined : createKeyGetter(spec);
  });

  /** Identity of the bound input, so a swapped source resets exactly once. */
  private activeInput: DataInput<T> | undefined;
  private rootController: AbortController | null = null;
  private revealController: AbortController | null = null;
  private readonly childControllers = new Map<K, AbortController>();
  private readonly childRequests = new Map<K, Promise<boolean>>();
  /** Branches whose level has arrived, so a second expansion does not refetch. */
  private loadedKeys = new Set<K>();
  /** Keys already looked up, so a failed resolution is not retried in a loop. */
  private attempted = new Set<K>();

  constructor(config: TreeNodeSourceConfig<T, K>) {
    this.config = config;
    const injector = inject(Injector);
    inject(DestroyRef).onDestroy(() => {
      this.cancelAll();
    });
    effect(
      () => {
        this.sync();
      },
      { injector },
    );
  }

  /** Whether the loader owns the model, rather than a host-supplied one. */
  bound(): boolean {
    return this.dataSource() !== undefined;
  }

  /** Whether the level below a node is in flight. */
  isLoadingChildren(key: K): boolean {
    return this.childLoading().has(key);
  }

  /** Whether the last attempt to load the level below a node rejected. */
  hasChildrenError(key: K): boolean {
    return this.childErrors().has(key);
  }

  /**
   * Makes the level below a node available. `true` means it already is, so the
   * local path expands in the same tick it did before this loader existed.
   */
  ensureChildren(node: TreeNode<T, K>): true | Promise<boolean> {
    if (!this.needsChildren(node)) {
      return true;
    }
    const inFlight = this.childRequests.get(node.key);
    if (inFlight !== undefined) {
      return inFlight;
    }
    const source = this.dataSource();
    if (source === undefined) {
      return true;
    }
    return this.startChildLoad(source, node);
  }

  /** Whether the level below a node has still to be loaded. */
  needsChildren(node: TreeNode<T, K>): boolean {
    return (
      this.dataSource()?.loadChildren !== undefined &&
      this.model().has(node.key) &&
      !this.loadedKeys.has(node.key)
    );
  }

  /** Drops the built tree and reloads the root level. */
  reload(): void {
    if (this.dataSource() === undefined) {
      return;
    }
    this.resetState();
    this.loadRoot();
  }

  /** Resets on a swapped source, then resolves whatever the value still needs. */
  private sync(): void {
    const input = this.config.source();
    if (input !== this.activeInput) {
      this.activeInput = input;
      this.resetState();
      if (input !== undefined) {
        this.loadRoot();
      }
    }
    if (input === undefined) {
      return;
    }
    this.resolveSelection();
  }

  private resetState(): void {
    this.cancelAll();
    this.model.set(new TreeModel<T, K>());
    this.loadedKeys = new Set();
    this.attempted = new Set();
    this.childLoading.set(new Set());
    this.childErrors.set(new Set());
    this.loading.set(false);
    this.error.set(null);
    this.resolving.set(false);
    this.failure.set(null);
  }

  private cancelAll(): void {
    this.rootController?.abort();
    this.rootController = null;
    this.revealController?.abort();
    this.revealController = null;
    for (const controller of this.childControllers.values()) {
      controller.abort();
    }
    this.childControllers.clear();
    this.childRequests.clear();
  }

  private loadRoot(): void {
    const source = this.dataSource();
    if (source === undefined) {
      return;
    }
    this.rootController?.abort();
    const controller = new AbortController();
    this.rootController = controller;
    this.loading.set(true);
    this.error.set(null);
    this.pendingTasks.run(() => this.runRootLoad(source, controller));
  }

  private async runRootLoad(source: DataSource<T>, controller: AbortController): Promise<void> {
    try {
      const result = await withAbort(
        this.loadLevel(source, null, controller.signal),
        controller.signal,
      );
      throwIfAborted(controller.signal);
      if (this.rootController !== controller) {
        return;
      }
      this.model.set(this.buildModel(source, result.rows));
    } catch (cause) {
      if (controller.signal.aborted || this.rootController !== controller) {
        return;
      }
      this.error.set(cause);
      this.config.onLoadError?.({ parent: null, cause });
    } finally {
      if (this.rootController === controller) {
        this.rootController = null;
        this.loading.set(false);
      }
    }
  }

  private startChildLoad(source: DataSource<T>, node: TreeNode<T, K>): Promise<boolean> {
    this.childControllers.get(node.key)?.abort();
    const controller = new AbortController();
    this.childControllers.set(node.key, controller);
    this.updateKeySet(this.childErrors, node.key, false);
    this.updateKeySet(this.childLoading, node.key, true);
    const request = this.runChildLoad(source, node, controller);
    this.childRequests.set(node.key, request);
    this.pendingTasks.run(() => request);
    return request;
  }

  private async runChildLoad(
    source: DataSource<T>,
    node: TreeNode<T, K>,
    controller: AbortController,
  ): Promise<boolean> {
    try {
      const result = await withAbort(
        this.loadLevel(source, node.key, controller.signal),
        controller.signal,
      );
      throwIfAborted(controller.signal);
      if (this.childControllers.get(node.key) !== controller) {
        return false;
      }
      this.attachChildren(node, result.rows);
      this.loadedKeys.add(node.key);
      return true;
    } catch (cause) {
      if (controller.signal.aborted || this.childControllers.get(node.key) !== controller) {
        return false;
      }
      this.updateKeySet(this.childErrors, node.key, true);
      this.config.onLoadError?.({ parent: node, cause });
      return false;
    } finally {
      if (this.childControllers.get(node.key) === controller) {
        this.childControllers.delete(node.key);
        this.childRequests.delete(node.key);
        this.updateKeySet(this.childLoading, node.key, false);
      }
    }
  }

  /**
   * A rejection must reach the `catch` above rather than the caller, so the
   * request is deferred even when the source throws instead of rejecting.
   */
  private loadLevel(
    source: DataSource<T>,
    parent: K | null,
    signal: AbortSignal,
  ): Promise<LoadResult<T>> {
    const request: LoadRequest = { signal };
    return Promise.resolve().then(() =>
      source.loadChildren === undefined
        ? source.load(request)
        : source.loadChildren(parent, request),
    );
  }

  private buildModel(source: DataSource<T>, rows: readonly T[]): TreeModel<T, K> {
    if (source.loadChildren !== undefined) {
      return new TreeModel(rows.map((item) => this.createNode(item)));
    }
    return new TreeModel(this.nestRows(rows));
  }

  /** Nests a flat collection through `parentKey`. An orphan becomes a root. */
  private nestRows(rows: readonly T[]): readonly TreeNode<T, K>[] {
    const byParent = new Map<K | null, T[]>();
    const present = new Set<K>();
    for (const item of rows) {
      present.add(this.treeKeyOf(item));
    }
    for (const item of rows) {
      const parent = this.parentKeyOf(item);
      const bucket = parent !== null && present.has(parent) ? parent : null;
      const siblings = byParent.get(bucket);
      if (siblings === undefined) {
        byParent.set(bucket, [item]);
      } else {
        siblings.push(item);
      }
    }

    const placed = new Set<K>();
    const build = (parent: K | null): TreeNode<T, K>[] =>
      (byParent.get(parent) ?? [])
        .filter((item) => !placed.has(this.treeKeyOf(item)))
        .map((item) => {
          const key = this.treeKeyOf(item);
          // Claim the key before recursing: a parent chain that points back at
          // itself would otherwise nest forever.
          placed.add(key);
          return this.createNode(item, build(key));
        });
    return build(null);
  }

  private attachChildren(node: TreeNode<T, K>, rows: readonly T[]): void {
    const model = this.model();
    for (const item of rows) {
      // A reveal walks the same levels, so a key can already be placed.
      if (!model.has(this.treeKeyOf(item))) {
        node.appendChild(this.createNode(item));
      }
    }
    // The level has arrived: the row is a branch only if it turned out to have one.
    node.expandable.set(false);
  }

  private createNode(item: T, children?: readonly TreeNode<T, K>[]): TreeNode<T, K> {
    const displayWith = this.config.displayWith();
    return new TreeNode<T, K>({
      key: this.treeKeyOf(item),
      data: item,
      label: displayWith === undefined ? String(item) : displayWith(item),
      disabled: this.config.nodeDisabled()?.(item) ?? false,
      expandable: this.declaresChildren(item, children),
      children,
    });
  }

  /**
   * A nested level already knows its own structure. A lazy level does not, so a
   * row stays expandable until an empty response proves it a leaf.
   */
  private declaresChildren(item: T, children?: readonly TreeNode<T, K>[]): boolean {
    if (children !== undefined) {
      return false;
    }
    const declared = this.config.hasChildren();
    return declared === undefined ? true : declared(item);
  }

  private treeKeyOf(item: T): K {
    const keyOf = this.keyGetter();
    if (keyOf === undefined) {
      throw new Error('tree: [key] is required while [source] is bound');
    }
    return assertTreeKey(keyOf(item)) as K;
  }

  private parentKeyOf(item: T): K | null {
    const selector = this.config.parentKey();
    if (selector === undefined) {
      return null;
    }
    const raw = typeof selector === 'function' ? selector(item) : readPath(item, selector);
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'bigint') {
      throw new Error('tree: [parentKey] must produce a string, a number, or null');
    }
    return assertTreeKey(raw) as K;
  }

  private updateKeySet(target: WritableSignal<ReadonlySet<K>>, key: K, member: boolean): void {
    const current = target();
    if (current.has(key) === member) {
      return;
    }
    const next = new Set(current);
    if (member) {
      next.add(key);
    } else {
      next.delete(key);
    }
    target.set(next);
  }

  /** Resolves selected keys the loaded levels do not contain. */
  private resolveSelection(): void {
    const model = this.model();
    // `size` is the reactive half: attaching a level leaves the model identity
    // alone, so a plain `has` check would never re-run this effect.
    model.size();
    if (this.loading() || this.error() !== null) {
      return;
    }
    const keys = this.config.keys();
    const missing = keys.filter((key) => !model.has(key) && !this.attempted.has(key));
    if (missing.length === 0) {
      if (keys.every((key) => model.has(key))) {
        this.failure.set(null);
      }
      return;
    }
    for (const key of missing) {
      this.attempted.add(key);
    }
    const source = this.dataSource();
    if (source === undefined) {
      return;
    }
    if (source.loadChildren === undefined) {
      // A flat source is loaded in full, so the key is genuinely absent.
      this.fail({ keys: missing, reason: 'notFound' });
      return;
    }
    if (source.byKeys === undefined || this.config.parentKey() === undefined) {
      this.fail({ keys: missing, reason: 'unsupported' });
      return;
    }
    this.pendingTasks.run(() => this.reveal(source, missing));
  }

  private async reveal(source: DataSource<T>, keys: readonly K[]): Promise<void> {
    this.revealController?.abort();
    const controller = new AbortController();
    this.revealController = controller;
    this.resolving.set(true);
    const unresolved: K[] = [];
    try {
      for (const key of keys) {
        const placed = await this.revealKey(source, key, controller.signal);
        throwIfAborted(controller.signal);
        if (!placed) {
          unresolved.push(key);
        }
      }
      if (unresolved.length > 0) {
        this.fail({ keys: unresolved, reason: 'notFound' });
      } else {
        this.failure.set(null);
      }
    } catch (cause) {
      if (controller.signal.aborted) {
        return;
      }
      this.fail({ keys, reason: 'loadFailed', cause });
    } finally {
      if (this.revealController === controller) {
        this.revealController = null;
        this.resolving.set(false);
      }
    }
  }

  /**
   * Walks up to a loaded ancestor with `byKeys`, then loads the levels back
   * down. Loading down rather than grafting the item in is what keeps every
   * level either absent or complete.
   */
  private async revealKey(source: DataSource<T>, key: K, signal: AbortSignal): Promise<boolean> {
    const path: K[] = [];
    let anchor: K | null = null;
    let current: K | null = key;
    for (let hop = 0; current !== null && hop < MAX_ANCESTOR_HOPS; hop += 1) {
      if (this.model().has(current)) {
        anchor = current;
        break;
      }
      const found = await this.lookup(source, current, signal);
      if (found === undefined) {
        return false;
      }
      path.unshift(current);
      current = this.parentKeyOf(found);
    }
    if (path.length === 0) {
      return this.model().has(key);
    }

    let parent = anchor;
    for (const step of path) {
      if (!this.model().has(step)) {
        if (parent === null) {
          // The root level is loaded and does not hold it.
          return false;
        }
        const parentNode = this.model().get(parent);
        if (parentNode === undefined) {
          return false;
        }
        const ready = this.ensureChildren(parentNode);
        if (ready !== true && !(await ready)) {
          return false;
        }
        if (!this.model().has(step)) {
          return false;
        }
      }
      parent = step;
    }

    const target = this.model().get(key);
    if (target === undefined) {
      return false;
    }
    for (const ancestor of target.ancestors()) {
      ancestor.expanded.set(true);
    }
    return true;
  }

  private async lookup(source: DataSource<T>, key: K, signal: AbortSignal): Promise<T | undefined> {
    if (source.byKeys === undefined) {
      return undefined;
    }
    const found = await withAbort(source.byKeys([key], signal), signal);
    throwIfAborted(signal);
    return found.length === 0 ? undefined : found[0];
  }

  private fail(failure: TreeResolutionFailure<K>): void {
    this.failure.set(failure);
    this.config.onFailure?.(failure);
  }
}

/** A source key has to be usable as a tree key, so a bigint is a declaration error. */
function assertTreeKey(key: DataKey): TreeKey {
  if (typeof key === 'bigint') {
    throw new Error('tree: a source key must be a string or a number');
  }
  return key;
}
