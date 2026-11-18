/**
 * Column lookups (§5.3).
 *
 * A lookup maps a stored value to a display value from a secondary
 * collection. One store per grid instance holds every column's entries, so the
 * display path, the header-filter option list and the editor option list read
 * one resolved collection and a grid never issues a request per row.
 */
import { computed, signal, type Signal } from '@angular/core';
import { isDataSource, type DataKey } from '@ui/data-source';
import { taggedValueKey } from './grouping/group-nodes';
import type { LookupSpec } from './types/column.types';
import type { Query } from './types/query.types';
import type { LookupEntry, LookupPage, LookupState, LookupBinding } from './lookup.store.types';

const EMPTY: LookupState = {
  entries: [],
  byValue: new Map(),
  loading: false,
  partial: false,
};

/** How many entries the store pulls from a paged source for the display map. */
const LOOKUP_PAGE_SIZE = 200;

/** Reads a member that is either a field name or a function. */
function read<TItem>(item: TItem, accessor: string | ((item: TItem) => unknown)): unknown {
  if (typeof accessor === 'function') {
    return accessor(item);
  }
  return (item as Record<string, unknown>)[accessor];
}

function bind<TItem>(spec: LookupSpec<TItem>): LookupBinding {
  return {
    declaration: spec,
    source: spec.source,
    toEntry: (item: unknown): LookupEntry => ({
      value: read(item as TItem, spec.value),
      display: read(item as TItem, spec.display),
    }),
  };
}

/** Whether a stored value can travel as a key. */
function isDataKey(value: unknown): value is DataKey {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint';
}

/** Text form of a display value, for the local search. Objects match nothing. */
function displayText(display: unknown): string {
  if (typeof display === 'string') {
    return display;
  }
  return typeof display === 'number' || typeof display === 'bigint' ? display.toString() : '';
}

function indexEntries(entries: readonly LookupEntry[]): Map<string, LookupEntry> {
  const byValue = new Map<string, LookupEntry>();
  for (const entry of entries) {
    // Last writer wins, so a collection with duplicate values resolves to one
    // display rather than to whichever order the source happened to return.
    byValue.set(taggedValueKey(entry.value), entry);
  }
  return byValue;
}

/**
 * Resolved lookup collections, one per column.
 *
 * Entries are loaded once per column and kept for the life of the grid: a
 * lookup describes a reference collection, and re-loading it because a row
 * scrolled into view is the request-per-row §5.3 forbids. {@link version}
 * changes when any collection resolves, which is what invalidates the rendered
 * rows that were drawn before it arrived.
 */
export class LookupStore {
  private readonly states = signal<ReadonlyMap<string, LookupState>>(new Map());
  private readonly writes = signal(0);
  private readonly bindings = new Map<string, LookupBinding>();
  /**
   * Values already looked up by key, per column, whether or not the source knew
   * them. A value the collection does not cover must not be re-requested every
   * time its row renders — that is the request-per-row §5.3 forbids.
   */
  private readonly attempted = new Map<string, Set<string>>();

  /**
   * Changes whenever a collection is written. A counter rather than a property
   * of the collections themselves: a reload that resolves to an equal list is
   * still a redraw, and no derived count would report it. The grid folds this
   * into the cached-row invalidation, so cells drawn before the lookup arrived
   * redraw with the display value and nothing else does.
   */
  readonly version: Signal<number> = computed(() => this.writes());

  /** Whether any column declares a lookup at all. */
  readonly active = computed(() => this.states().size > 0);

  /** The resolved entries of one column. Empty until the collection arrives. */
  entries(columnId: string): readonly LookupEntry[] {
    return this.states().get(columnId)?.entries ?? EMPTY.entries;
  }

  /** Whether the collection is still loading. */
  loading(columnId: string): boolean {
    return this.states().get(columnId)?.loading ?? false;
  }

  /** Whether the source holds more entries than the store has loaded. */
  partial(columnId: string): boolean {
    return this.states().get(columnId)?.partial ?? false;
  }

  /**
   * The display value for a stored value, or `undefined` when the lookup does
   * not cover it — which is what makes the caller fall back to the raw value
   * rather than render an empty cell for an unmapped code.
   */
  displayOf(columnId: string, value: unknown): unknown {
    return this.states().get(columnId)?.byValue.get(taggedValueKey(value))?.display;
  }

  /**
   * Starts the load for one column, once. Re-declaring the same spec object
   * does nothing; a different one reloads, because the collection changed.
   */
  ensure<TItem>(columnId: string, spec: LookupSpec<TItem>): void {
    if (this.bindings.get(columnId)?.declaration === spec) {
      return;
    }
    const binding = bind(spec);
    this.bindings.set(columnId, binding);
    // A different collection knows different values, so what was tried against
    // the old one says nothing about this one.
    this.attempted.delete(columnId);
    if (!isDataSource(binding.source)) {
      const entries = binding.source.map(binding.toEntry);
      this.write(columnId, { ...EMPTY, entries, byValue: indexEntries(entries) });
      return;
    }
    this.write(columnId, { ...EMPTY, loading: true });
    void this.loadFromSource(columnId, binding);
  }

  /**
   * One page of a lookup's collection, searched by the source when it can.
   *
   * For a surface that offers its own paging and search over a large
   * collection. The display map built by {@link ensure} is unaffected: a
   * search narrows what a panel lists, not what the grid resolves values with.
   */
  async page(
    columnId: string,
    options: { search?: string | null; skip?: number; take?: number; signal?: AbortSignal } = {},
  ): Promise<LookupPage> {
    const binding = this.bindings.get(columnId);
    if (binding == null) {
      return { entries: [], hasMore: false };
    }
    const take = options.take ?? LOOKUP_PAGE_SIZE;
    const skip = options.skip ?? 0;
    const needle = (options.search ?? '').trim().toLocaleLowerCase();
    if (!isDataSource(binding.source)) {
      const all = binding.source
        .map(binding.toEntry)
        .filter(
          (entry) =>
            needle === '' || displayText(entry.display).toLocaleLowerCase().includes(needle),
        );
      return { entries: all.slice(skip, skip + take), hasMore: all.length > skip + take };
    }
    // One extra entry answers "is there another page" without a count the
    // source may not have.
    const query: Query = {
      skip,
      take: take + 1,
      search: needle === '' ? null : needle,
      ...(options.signal == null ? {} : { signal: options.signal }),
    };
    const result = await binding.source.load(query);
    const entries = result.rows.map(binding.toEntry);
    return { entries: entries.slice(0, take), hasMore: entries.length > take };
  }

  /**
   * Resolves the stored values on screen that the loaded collection does not
   * cover, through the source's `byKeys` (§5.3).
   *
   * The prefetch {@link ensure} runs reads the head of the collection, so a
   * value beyond it renders as its raw code. `byKeys` is what fixes that: the
   * grid names the values it is about to draw and the source answers for those
   * alone, which is one request per load rather than one per row.
   *
   * A no-op when the source declares no `byKeys` — presence is the capability,
   * so a lookup without it keeps the prefetch and its `partial` notice. Values
   * are attempted once per collection whether or not the source knew them.
   */
  async resolveValues(
    columnId: string,
    values: readonly unknown[],
    signal?: AbortSignal,
  ): Promise<void> {
    const binding = this.bindings.get(columnId);
    if (binding == null) {
      return;
    }
    // Held as a const so the narrowing survives the await, and called through
    // rather than destructured so the method keeps its own `this`.
    const source = binding.source;
    if (!isDataSource(source) || source.byKeys === undefined) {
      return;
    }

    const known = this.states().get(columnId)?.byValue ?? EMPTY.byValue;
    const tried = this.attempted.get(columnId) ?? new Set<string>();
    const wanted = new Map<string, DataKey>();
    for (const value of values) {
      if (!isDataKey(value)) {
        continue;
      }
      const key = taggedValueKey(value);
      if (known.has(key) || tried.has(key) || wanted.has(key)) {
        continue;
      }
      wanted.set(key, value);
    }
    if (wanted.size === 0) {
      return;
    }

    // Marked before the request, not after: two loads naming the same value
    // must not both ask for it.
    for (const key of wanted.keys()) {
      tried.add(key);
    }
    this.attempted.set(columnId, tried);

    let items: readonly unknown[];
    try {
      items = await source.byKeys([...wanted.values()], signal);
    } catch {
      // The raw values keep showing, which is the truthful fallback. A
      // reference lookup failing is not a grid load error.
      return;
    }
    if (this.bindings.get(columnId) !== binding || items.length === 0) {
      return;
    }

    const state = this.states().get(columnId) ?? EMPTY;
    const byValue = new Map(state.byValue);
    for (const item of items) {
      const entry = binding.toEntry(item);
      byValue.set(taggedValueKey(entry.value), entry);
    }
    this.write(columnId, { ...state, byValue });
  }

  /** Drops every collection, so the next {@link ensure} reloads. */
  clear(): void {
    this.states.set(new Map());
    this.bindings.clear();
    this.attempted.clear();
    this.writes.update((count) => count + 1);
  }

  private async loadFromSource(columnId: string, binding: LookupBinding): Promise<void> {
    try {
      const page = await this.page(columnId, { take: LOOKUP_PAGE_SIZE });
      // The declaration may have been replaced while the request was in
      // flight; the newer one owns the column.
      if (this.bindings.get(columnId) !== binding) {
        return;
      }
      this.write(columnId, {
        entries: page.entries,
        byValue: indexEntries(page.entries),
        loading: false,
        partial: page.hasMore,
      });
    } catch {
      // A lookup that fails to load leaves the raw values showing, which is
      // the truthful fallback. The grid reports load failures for its own
      // data; a reference collection failing is not a grid load error.
      if (this.bindings.get(columnId) === binding) {
        this.write(columnId, EMPTY);
      }
    }
  }

  private write(columnId: string, state: LookupState): void {
    const next = new Map(this.states());
    next.set(columnId, state);
    this.states.set(next);
    this.writes.update((count) => count + 1);
  }
}
