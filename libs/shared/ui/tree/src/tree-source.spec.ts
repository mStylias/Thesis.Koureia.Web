import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import type { DataInput, DataKey, DataSource } from '@ui/data-source';
import { TreeModel } from './tree-model';
import { TreeNode } from './tree-node';
import { Tree } from './tree';
import type { TreeLoadFailure, TreeParentSelector, TreeResolutionFailure } from './tree-source';
import type { TreeSelectionMode } from './tree.types';

interface Region {
  readonly id: number;
  readonly name: string;
  readonly parentId: number | null;
  readonly branch: boolean;
}

const REGIONS: readonly Region[] = [
  { id: 1, name: 'Cyprus', parentId: null, branch: true },
  { id: 2, name: 'Limassol', parentId: 1, branch: true },
  { id: 3, name: 'Nicosia', parentId: 1, branch: false },
  { id: 4, name: 'Old Port', parentId: 2, branch: false },
  { id: 5, name: 'Greece', parentId: null, branch: false },
];

const childrenOf = (parent: DataKey | null): readonly Region[] =>
  REGIONS.filter((region) => (region.parentId ?? null) === parent);

interface Deferred<TValue> {
  readonly promise: Promise<TValue>;
  resolve(value: TValue): void;
  reject(reason: Error): void;
}

function deferred<TValue>(): Deferred<TValue> {
  let resolve!: (value: TValue) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<TValue>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface FakeSource extends DataSource<Region> {
  /** Every level requested, in order. `null` is the root. */
  readonly levels: (DataKey | null)[];
  readonly lookups: (readonly DataKey[])[];
  /** Levels answered with a rejection instead of rows. */
  readonly failing: Set<DataKey | null>;
  /** Levels held open until the test resolves them. */
  readonly pending: Map<DataKey | null, Deferred<readonly Region[]>>;
}

/** A lazy source: one level per request, exactly as `loadChildren` declares. */
function createLazySource(withByKeys = true): FakeSource {
  const levels: (DataKey | null)[] = [];
  const lookups: (readonly DataKey[])[] = [];
  const failing = new Set<DataKey | null>();
  const pending = new Map<DataKey | null, Deferred<readonly Region[]>>();
  const source: FakeSource = {
    levels,
    lookups,
    failing,
    pending,
    load: () => Promise.resolve({ rows: REGIONS }),
    loadChildren: (parent) => {
      levels.push(parent);
      if (failing.has(parent)) {
        return Promise.reject(new Error(`level ${String(parent)} failed`));
      }
      const held = pending.get(parent);
      if (held !== undefined) {
        return held.promise.then((rows) => ({ rows }));
      }
      return Promise.resolve({ rows: childrenOf(parent) });
    },
  };
  if (withByKeys) {
    source.byKeys = (keys) => {
      lookups.push(keys);
      return Promise.resolve(REGIONS.filter((region) => keys.includes(region.id)));
    };
  }
  return source;
}

/** A flat source: the whole collection in one response, nested by the control. */
function createFlatSource(): FakeSource {
  const levels: (DataKey | null)[] = [];
  return {
    levels,
    lookups: [],
    failing: new Set(),
    pending: new Map(),
    load: () => {
      levels.push(null);
      return Promise.resolve({ rows: REGIONS });
    },
  };
}

@Component({
  imports: [Tree],
  template: `
    <lib-tree
      [tree]="tree()"
      [source]="source()"
      key="id"
      [displayWith]="displayWith"
      [hasChildren]="hasChildren()"
      [parentKey]="parentKey()"
      [(value)]="value"
      [selectionMode]="selectionMode()"
      ariaLabel="Regions"
      (resolutionFailed)="failures.push($event)"
      (loadFailed)="loadFailures.push($event)"
    />
  `,
})
class SourceHost {
  readonly component = viewChild.required<Tree<Region, number>>(Tree);
  readonly tree = signal<TreeModel<Region, number> | undefined>(undefined);
  readonly source = signal<DataInput<Region> | undefined>(undefined);
  readonly hasChildren = signal<((item: Region) => boolean) | undefined>(undefined);
  readonly parentKey = signal<TreeParentSelector<Region> | undefined>(undefined);
  readonly value = signal<readonly number[]>([]);
  readonly selectionMode = signal<TreeSelectionMode>('single');
  readonly displayWith = (item: Region): string => item.name;
  readonly failures: TreeResolutionFailure<number>[] = [];
  readonly loadFailures: TreeLoadFailure<Region, number>[] = [];
}

describe('Tree bound to a data source', () => {
  let fixture: ComponentFixture<SourceHost>;
  let host: SourceHost;

  function element(): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('lib-tree');
    if (!found) {
      throw new Error('lib-tree not rendered');
    }
    return found;
  }

  function query(selector: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  }

  /**
   * Loads the lib's lazy scope. Order matters: a `TranslocoPipe` has to transform
   * first, or the service caches an empty translation under the key forever.
   */
  async function loadScope(): Promise<void> {
    await firstValueFrom(TestBed.inject(TranslocoService).load('tree/en'));
    await settle();
  }

  function items(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="treeitem"]'));
  }

  function labelOf(entry: HTMLElement): string {
    const content = entry.querySelector<HTMLElement>(':scope > .tree-row > .tree-content');
    return (content?.textContent ?? '').trim();
  }

  function labels(): string[] {
    return items().map(labelOf);
  }

  function item(label: string): HTMLElement {
    const found = items().find((entry) => labelOf(entry) === label);
    if (!found) {
      throw new Error(`tree item ${label} not rendered`);
    }
    return found;
  }

  function row(label: string): HTMLElement {
    const found = item(label).querySelector<HTMLElement>(':scope > .tree-row');
    if (!found) {
      throw new Error(`tree row ${label} not rendered`);
    }
    return found;
  }

  function labelHit(label: string): HTMLElement {
    const found = item(label).querySelector<HTMLElement>('.tree-label-hit');
    if (!found) {
      throw new Error(`tree label ${label} not rendered`);
    }
    return found;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Renders without waiting for stability, so an in-flight load stays in flight. */
  function render(): void {
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    });
    fixture = TestBed.createComponent(SourceHost);
    host = fixture.componentInstance;
    await settle();
  });

  describe('a lazy source', () => {
    let source: FakeSource;

    beforeEach(async () => {
      source = createLazySource();
      host.source.set(source);
      await settle();
    });

    it('loads the root level and nothing below it', () => {
      expect(source.levels).toEqual([null]);
      expect(labels()).toEqual(['Cyprus', 'Greece']);
    });

    it('loads one level per expansion and expands once it arrives', async () => {
      row('Cyprus').click();
      await settle();

      expect(source.levels).toEqual([null, 1]);
      expect(item('Cyprus').getAttribute('aria-expanded')).toBe('true');
      expect(labels()).toEqual(['Cyprus', 'Limassol', 'Nicosia', 'Greece']);

      row('Cyprus').click();
      await settle();
      row('Cyprus').click();
      await settle();

      // A collapsed level is not refetched.
      expect(source.levels).toEqual([null, 1]);
    });

    it('marks the row busy and shows a spinner while its level loads', async () => {
      const held = deferred<readonly Region[]>();
      source.pending.set(1, held);

      row('Cyprus').click();
      render();

      expect(item('Cyprus').getAttribute('aria-busy')).toBe('true');
      expect(item('Cyprus').hasAttribute('data-children-loading')).toBe(true);
      expect(item('Cyprus').querySelector('.tree-spinner')).not.toBeNull();
      // The branch waits for its children rather than opening onto nothing.
      expect(item('Cyprus').getAttribute('aria-expanded')).toBe('false');

      held.resolve(childrenOf(1));
      await settle();

      expect(item('Cyprus').hasAttribute('data-children-loading')).toBe(false);
      expect(item('Cyprus').getAttribute('aria-expanded')).toBe('true');
    });

    it('turns a row an empty level proves childless into a leaf', async () => {
      expect(item('Greece').hasAttribute('data-branch')).toBe(true);

      row('Greece').click();
      await settle();

      expect(source.levels).toEqual([null, 5]);
      expect(item('Greece').hasAttribute('data-branch')).toBe(false);
      expect(item('Greece').querySelector('.tree-chevron svg')).toBeNull();
    });

    it('trusts a declared branch rule instead of probing every row', async () => {
      host.hasChildren.set((region) => region.branch);
      host.source.set(createLazySource());
      await settle();

      expect(item('Cyprus').hasAttribute('data-branch')).toBe(true);
      expect(item('Greece').hasAttribute('data-branch')).toBe(false);

      row('Greece').click();
      await settle();

      expect(item('Greece').getAttribute('aria-expanded')).toBeNull();
    });

    it('keeps a branch collapsed when its level rejects, then retries', async () => {
      source.failing.add(1);

      row('Cyprus').click();
      await settle();

      expect(item('Cyprus').getAttribute('aria-expanded')).toBe('false');
      expect(item('Cyprus').hasAttribute('data-children-error')).toBe(true);
      await loadScope();
      expect(item('Cyprus').querySelector('.tree-node-error')?.textContent.trim()).toBe(
        'Could not load',
      );
      expect(host.loadFailures.at(-1)?.parent?.key).toBe(1);

      source.failing.delete(1);
      row('Cyprus').click();
      await settle();

      expect(item('Cyprus').hasAttribute('data-children-error')).toBe(false);
      expect(item('Cyprus').getAttribute('aria-expanded')).toBe('true');
    });

    it('reports a rejected root level and reloads on demand', async () => {
      const failed = createLazySource();
      failed.failing.add(null);
      host.source.set(failed);
      await settle();

      expect(items()).toHaveLength(0);
      expect(element().hasAttribute('data-unresolved')).toBe(false);
      await loadScope();
      expect(query('.tree-empty-error')?.textContent.trim()).toBe('Could not load the items');
      expect(host.loadFailures.at(-1)?.parent).toBeNull();

      failed.failing.delete(null);
      host.component().reload();
      await settle();

      expect(labels()).toEqual(['Cyprus', 'Greece']);
    });

    it('skips unloaded branches in expandAll rather than fetching every level', async () => {
      host.component().expandAll();
      await settle();

      expect(source.levels).toEqual([null]);
      expect(item('Cyprus').getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('a persisted selection', () => {
    it('walks up with byKeys and loads the levels back down', async () => {
      const source = createLazySource();
      host.parentKey.set('parentId');
      host.value.set([4]);
      host.source.set(source);
      await settle();

      expect(source.lookups).toEqual([[4], [2]]);
      expect(source.levels).toEqual([null, 1, 2]);
      expect(labels()).toEqual(['Cyprus', 'Limassol', 'Old Port', 'Nicosia', 'Greece']);
      expect(item('Old Port').getAttribute('aria-selected')).toBe('true');
      expect(element().hasAttribute('data-unresolved')).toBe(false);
    });

    it('keeps a key it cannot place and reports why', async () => {
      const source = createLazySource();
      host.parentKey.set('parentId');
      host.value.set([99]);
      host.source.set(source);
      await settle();

      expect(host.value()).toEqual([99]);
      expect(element().hasAttribute('data-unresolved')).toBe(true);
      expect(host.failures).toEqual([{ keys: [99], reason: 'notFound' }]);
      await loadScope();
      const note = query('.tree-note');
      expect(note?.textContent.trim()).toBe('Unavailable values (1)');
      expect(query('[role="tree"]')?.getAttribute('aria-describedby')).toBe(note?.id);
    });

    it('reports an unsupported lookup rather than clearing the value', async () => {
      host.parentKey.set('parentId');
      host.value.set([4]);
      host.source.set(createLazySource(false));
      await settle();

      expect(host.value()).toEqual([4]);
      expect(host.failures.at(-1)?.reason).toBe('unsupported');
    });

    it('reports an unsupported lookup while no parent identity is declared', async () => {
      host.value.set([4]);
      host.source.set(createLazySource());
      await settle();

      expect(host.failures.at(-1)?.reason).toBe('unsupported');
    });

    it('carries an unloaded key through the next user selection', async () => {
      host.selectionMode.set('multiple');
      host.value.set([4]);
      host.source.set(createLazySource());
      await settle();

      expect(host.failures.at(-1)?.reason).toBe('unsupported');

      labelHit('Greece').click();
      await settle();

      // Angular Aria only knows the rendered rows; dropping the rest would take
      // the unloaded key out of the form.
      expect(host.value()).toEqual([5, 4]);
    });
  });

  describe('a flat source', () => {
    it('nests one response through parentKey', async () => {
      const source = createFlatSource();
      host.parentKey.set('parentId');
      host.source.set(source);
      await settle();

      expect(source.levels).toEqual([null]);
      expect(labels()).toEqual(['Cyprus', 'Greece']);

      row('Cyprus').click();
      await settle();

      // Nothing more is fetched: the level was in the first response.
      expect(source.levels).toEqual([null]);
      expect(labels()).toEqual(['Cyprus', 'Limassol', 'Nicosia', 'Greece']);
    });

    it('takes a plain array through the same pipeline', async () => {
      host.parentKey.set((region) => region.parentId);
      host.source.set(REGIONS);
      await settle();

      expect(labels()).toEqual(['Cyprus', 'Greece']);

      row('Cyprus').click();
      await settle();

      expect(labels()).toEqual(['Cyprus', 'Limassol', 'Nicosia', 'Greece']);
    });

    it('reports a missing key as absent without a lookup', async () => {
      host.parentKey.set('parentId');
      host.value.set([99]);
      host.source.set(REGIONS);
      await settle();

      expect(host.value()).toEqual([99]);
      expect(host.failures).toEqual([{ keys: [99], reason: 'notFound' }]);
    });

    it('keeps an orphan as a root rather than dropping it', async () => {
      host.parentKey.set('parentId');
      host.source.set([{ id: 7, name: 'Orphan', parentId: 404, branch: false }]);
      await settle();

      expect(labels()).toEqual(['Orphan']);
    });
  });

  it('leaves the source idle while a model is bound', async () => {
    const source = createLazySource();
    host.tree.set(
      new TreeModel<Region, number>([new TreeNode({ key: 1, data: REGIONS[0], label: 'Local' })]),
    );
    host.source.set(source);
    await settle();

    expect(source.levels).toEqual([]);
    expect(labels()).toEqual(['Local']);
  });
});
