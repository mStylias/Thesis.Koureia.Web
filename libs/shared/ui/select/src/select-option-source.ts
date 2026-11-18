import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  PendingTasks,
  signal,
} from '@angular/core';
import {
  createKeyGetter,
  serializeKey,
  throwIfAborted,
  withAbort,
  type DataKey,
  type DataSource,
  type KeySpec,
  type LoadResult,
} from '@ui/data-source';
import type { SelectOption } from './select.types';

/** Why a bound key has no item to render. */
export type SelectResolutionReason = 'notFound' | 'unsupported' | 'loadFailed';

/** A bound value the source could not turn into a displayable item. */
export interface SelectResolutionFailure {
  readonly keys: readonly DataKey[];
  readonly reason: SelectResolutionReason;
  readonly cause?: unknown;
}

/** What the loader reads from the control it serves. Every member is a signal getter. */
export interface SelectOptionSourceConfig<TItem> {
  /** The bound source. `undefined` keeps the loader idle, which is the `options` path. */
  readonly source: () => DataSource<TItem> | undefined;
  /** Item identity. Required as soon as a source is bound. */
  readonly key: () => KeySpec<TItem> | undefined;
  /** Option text. Falls back to `String(item)`. */
  readonly displayWith: () => ((item: TItem) => string) | undefined;
  /** Per-item disabled rule. */
  readonly optionDisabled: () => ((item: TItem) => boolean) | undefined;
  /** Keys the control has to render right now, whether or not they are loaded. */
  readonly keys: () => readonly DataKey[];
  readonly pageSize: () => number;
  readonly debounceMs: () => number;
  /** Called once per failed resolution, so the control can report it. */
  readonly onFailure?: (failure: SelectResolutionFailure) => void;
}

/**
 * Loads, pages, searches and key-resolves the options of a `lib-select` or
 * `lib-multi-select` bound to a `DataSource`. Construct it in a field
 * initializer: it takes its own `Injector` and `DestroyRef` from the
 * surrounding injection context.
 *
 * The control owns the debounce and the abort, never the source. A source that
 * debounced could not also serve a datagrid, which must not.
 */
export class SelectOptionSource<TItem> {
  private readonly config: SelectOptionSourceConfig<TItem>;

  /** Items of the loaded pages, in source order. */
  readonly rows = signal<readonly TItem[]>([]);
  /** A page load is in flight. */
  readonly loading = signal(false);
  /** A `byKeys` lookup for the bound value is in flight. */
  readonly resolving = signal(false);
  /** The last page load rejected. */
  readonly error = signal<unknown>(null);
  /** Another page exists. */
  readonly hasMore = signal(false);
  /** The active query, as the user typed it. */
  readonly search = signal('');
  /** A bound value that has no item to display, and why. */
  readonly failure = signal<SelectResolutionFailure | null>(null);

  /** Every item seen through a page or a `byKeys` lookup, by serialized key. */
  private readonly items = signal<ReadonlyMap<string, TItem>>(new Map());
  private readonly activeSource = signal<DataSource<TItem> | undefined>(undefined);

  private readonly keyGetter = computed(() => {
    const spec = this.config.key();
    return spec === undefined ? undefined : createKeyGetter(spec);
  });

  /** The loaded page as select options, keyed by the declared key. */
  readonly options = computed<readonly SelectOption<DataKey, TItem>[]>(() =>
    this.rows().map((item) => this.toOption(item)),
  );

  private readonly pendingTasks = inject(PendingTasks);
  private loadController: AbortController | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private loadGeneration = 0;
  private resolveController: AbortController | null = null;
  /** Keys already looked up under the active source, so a failure is not retried. */
  private attempted = new Set<string>();
  private loaded = false;

  constructor(config: SelectOptionSourceConfig<TItem>) {
    this.config = config;
    const injector = inject(Injector);
    inject(DestroyRef).onDestroy(() => {
      this.cancelLoad();
      this.resolveController?.abort();
    });
    // A swapped source resets here rather than in `ngOnChanges`: that hook runs
    // inside change detection and cancels a load a focus handler started in the
    // same pass.
    effect(
      () => {
        this.sync();
      },
      { injector },
    );
  }

  /** The option for a key, from any page or lookup this loader has seen. */
  optionFor(key: DataKey): SelectOption<DataKey, TItem> | undefined {
    const item = this.items().get(serializeKey(key));
    return item === undefined ? undefined : this.toOption(item);
  }

  /** Loads the first page unless one is already loaded. Called when the panel opens. */
  open(): void {
    if (this.config.source() === undefined) {
      return;
    }
    if (!this.loaded || this.error() !== null) {
      this.startLoad(this.search(), false, 0);
    }
  }

  /** Runs a new query after the configured debounce. */
  setSearch(text: string): void {
    if (text === this.search() || this.config.source() === undefined) {
      return;
    }
    this.search.set(text);
    this.startLoad(text, false, this.safeDebounce());
  }

  /**
   * Drops the query when the panel closes. The next open reloads the unfiltered
   * first page rather than spending a request the user may never see.
   */
  closed(): void {
    if (this.search() === '') {
      return;
    }
    this.cancelLoad();
    this.search.set('');
    this.rows.set([]);
    this.hasMore.set(false);
    this.loaded = false;
  }

  /** Drops the query and reloads the unfiltered first page. */
  clearSearch(): void {
    if (this.search() === '') {
      return;
    }
    this.search.set('');
    this.startLoad('', false, 0);
  }

  /** Appends the next page, if one exists. */
  loadMore(): void {
    if (!this.hasMore() || this.loading() || this.config.source() === undefined) {
      return;
    }
    this.startLoad(this.search(), true, 0);
  }

  /** Re-runs the active query. */
  reload(): void {
    if (this.config.source() === undefined) {
      return;
    }
    this.startLoad(this.search(), false, 0);
  }

  private toOption(item: TItem): SelectOption<DataKey, TItem> {
    return {
      label: this.labelOf(item),
      value: this.requireKey()(item),
      disabled: this.config.optionDisabled()?.(item) ?? false,
      item,
    };
  }

  private labelOf(item: TItem): string {
    const displayWith = this.config.displayWith();
    return displayWith ? displayWith(item) : String(item);
  }

  private requireKey(): (item: TItem) => DataKey {
    const keyOf = this.keyGetter();
    if (keyOf === undefined) {
      throw new Error('select: [key] is required while [source] is bound');
    }
    return keyOf;
  }

  private safeDebounce(): number {
    const value = this.config.debounceMs();
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private safePageSize(): number {
    const value = this.config.pageSize();
    return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 20;
  }

  /** Resets on a swapped source, then resolves whatever the value still needs. */
  private sync(): void {
    const source = this.config.source();
    if (source !== this.activeSource()) {
      this.reset(source);
    }
    if (source === undefined) {
      return;
    }
    const cache = this.items();
    const missing = this.config
      .keys()
      .filter((key) => !cache.has(serializeKey(key)) && !this.attempted.has(serializeKey(key)));
    if (missing.length === 0) {
      // Every key is displayable again, so a failure from an earlier value is stale.
      if (this.config.keys().every((key) => cache.has(serializeKey(key)))) {
        this.failure.set(null);
      }
      return;
    }
    for (const key of missing) {
      this.attempted.add(serializeKey(key));
    }
    if (source.byKeys === undefined) {
      this.fail({ keys: missing, reason: 'unsupported' });
      return;
    }
    this.pendingTasks.run(() => this.resolve(source, missing));
  }

  private fail(failure: SelectResolutionFailure): void {
    this.failure.set(failure);
    this.config.onFailure?.(failure);
  }

  private reset(source: DataSource<TItem> | undefined): void {
    this.cancelLoad();
    this.resolveController?.abort();
    this.resolveController = null;
    this.activeSource.set(source);
    this.items.set(new Map());
    this.attempted = new Set();
    this.rows.set([]);
    this.hasMore.set(false);
    this.error.set(null);
    this.failure.set(null);
    this.search.set('');
    this.resolving.set(false);
    this.loaded = false;
  }

  private async resolve(source: DataSource<TItem>, keys: readonly DataKey[]): Promise<void> {
    if (source.byKeys === undefined) {
      return;
    }
    this.resolveController?.abort();
    const controller = new AbortController();
    this.resolveController = controller;
    this.resolving.set(true);
    try {
      const found = await withAbort(source.byKeys(keys, controller.signal), controller.signal);
      throwIfAborted(controller.signal);
      this.remember(found);
      const keyOf = this.requireKey();
      const resolved = new Set(found.map((item) => serializeKey(keyOf(item))));
      const missing = keys.filter((key) => !resolved.has(serializeKey(key)));
      if (missing.length) {
        this.fail({ keys: missing, reason: 'notFound' });
      } else {
        this.failure.set(null);
      }
    } catch (cause) {
      if (controller.signal.aborted) {
        return;
      }
      this.fail({ keys, reason: 'loadFailed', cause });
    } finally {
      if (this.resolveController === controller) {
        this.resolveController = null;
        this.resolving.set(false);
      }
    }
  }

  private startLoad(search: string, append: boolean, delay: number): void {
    const source = this.config.source();
    if (source === undefined) {
      return;
    }
    this.cancelLoad();
    const generation = ++this.loadGeneration;
    const controller = new AbortController();
    this.loadController = controller;
    this.loaded = true;
    this.error.set(null);
    this.loading.set(true);
    if (!append) {
      this.rows.set([]);
      this.hasMore.set(false);
    }

    const run = (): void => {
      this.loadTimer = null;
      this.pendingTasks.run(() => this.loadPage(source, search, append, generation, controller));
    };
    if (delay > 0) {
      this.loadTimer = setTimeout(run, delay);
    } else {
      run();
    }
  }

  private async loadPage(
    source: DataSource<TItem>,
    search: string,
    append: boolean,
    generation: number,
    controller: AbortController,
  ): Promise<void> {
    const pageSize = this.safePageSize();
    const skip = append ? this.rows().length : 0;
    try {
      // One row past the page proves another page exists without a `$count` the
      // endpoint may not opt into.
      const result = await withAbort(
        source.load({ search, skip, take: pageSize + 1, signal: controller.signal }),
        controller.signal,
      );
      throwIfAborted(controller.signal);
      if (generation !== this.loadGeneration) {
        return;
      }
      this.applyPage(result, skip, pageSize, append);
    } catch (error) {
      if (controller.signal.aborted || generation !== this.loadGeneration) {
        return;
      }
      this.error.set(error);
    } finally {
      if (generation === this.loadGeneration) {
        this.loading.set(false);
      }
    }
  }

  private applyPage(
    result: LoadResult<TItem>,
    skip: number,
    pageSize: number,
    append: boolean,
  ): void {
    const page = result.rows.slice(0, pageSize);
    this.rows.set(append ? this.merge(this.rows(), page) : page);
    this.remember(page);
    // The over-fetched row outranks the source's own answer: a `hasMore` computed
    // over the rows it returned reports `false` on the page that withheld the probe.
    this.hasMore.set(
      result.rows.length > pageSize ||
        (result.hasMore ??
          (result.totalCount === undefined ? false : skip + page.length < result.totalCount)),
    );
  }

  private merge(current: readonly TItem[], page: readonly TItem[]): readonly TItem[] {
    const keyOf = this.requireKey();
    const seen = new Set(current.map((item) => serializeKey(keyOf(item))));
    return [...current, ...page.filter((item) => !seen.has(serializeKey(keyOf(item))))];
  }

  /** Caches items so a selection keeps its label after the query moves on. */
  private remember(items: readonly TItem[]): void {
    if (items.length === 0) {
      return;
    }
    const keyOf = this.requireKey();
    const next = new Map(this.items());
    for (const item of items) {
      next.set(serializeKey(keyOf(item)), item);
    }
    this.items.set(next);
  }

  private cancelLoad(): void {
    if (this.loadTimer !== null) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
    this.loadController?.abort();
    this.loadController = null;
    this.loading.set(false);
  }
}
