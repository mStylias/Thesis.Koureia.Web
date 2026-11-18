/**
 * Named views (§14.4).
 *
 * The two things worth proving here are the ones a unit test of the list
 * cannot reach: that the document is read **before** the first data query goes
 * out, and that the strip's affordances are gated by the same rules the menu
 * states.
 */
import { Component, getDebugNode, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Tooltip } from '@ui/tooltip';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  SAVED_VIEWS_VERSION,
  VIEW_NAME_MAX_LENGTH,
  provideSavedViewsStorage,
  type SavedViewsController,
} from '@ui/saved-views/core';
import { Datagrid } from './datagrid';
import { GRID_STATE_VERSION } from './core/state';
import { gridViews } from './features';
import type { DatagridFeature } from './features.types';
import type { ColumnDef } from './core/types/column.types';
import type { ToolbarConfig } from './core/types/config.types';
import type { GridDataSource, Query, QueryResult, SortSpec } from './core/types/query.types';
import type { GridState } from './core/types/state.types';
import type { GridViewsDocument, GridViewsStorage } from './core/views/views.types';

interface Row {
  id: number;
  name: string;
  city: string;
}

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', width: 200 },
  { id: 'city', field: 'city', caption: 'City', width: 150 },
];

const ROWS: Row[] = [
  { id: 1, name: 'Alpha', city: 'Nicosia' },
  { id: 2, name: 'Beta', city: 'Limassol' },
];

/**
 * A state in the shape `serializeGridState` produces.
 *
 * Hand-authored, and complete on purpose: a stored state missing a member the
 * grid emits would read as dirty the moment it is applied, which is a real
 * failure mode and not one this file should hide behind a partial fixture.
 */
function stateSortedBy(field: 'name' | 'city'): GridState {
  const sort = { order: 'asc' as const, index: 0 };
  return {
    version: GRID_STATE_VERSION,
    columns: [
      {
        id: 'name',
        visible: true,
        visibleIndex: 0,
        width: 200,
        pinned: false as const,
        ...(field === 'name' ? { sort } : {}),
      },
      {
        id: 'city',
        visible: true,
        visibleIndex: 1,
        width: 150,
        pinned: false as const,
        ...(field === 'city' ? { sort } : {}),
      },
    ],
  };
}

function document(...names: string[]): GridViewsDocument {
  return {
    version: SAVED_VIEWS_VERSION,
    views: names.map((name, index) => ({
      id: `view-${index.toString()}`,
      name,
      state: stateSortedBy(index === 0 ? 'city' : 'name'),
    })),
  };
}

/** Records every query, so "the view was applied first" is measurable. */
class CountingSource implements GridDataSource<Row> {
  readonly queries: Query[] = [];
  load(query: Query): Promise<QueryResult<Row>> {
    this.queries.push(query);
    return Promise.resolve({ rows: [...ROWS], totalCount: ROWS.length });
  }
}

/** A storage whose writes are inspectable, and whose load can be made to fail. */
class RecordingStorage implements GridViewsStorage {
  readonly writes: GridViewsDocument[] = [];
  failSave = false;
  constructor(private stored: GridViewsDocument | null) {}
  load(): Promise<GridViewsDocument | null> {
    return Promise.resolve(this.stored);
  }
  save(_key: string, next: GridViewsDocument): Promise<void> {
    if (this.failSave) {
      return Promise.reject(new Error('offline'));
    }
    this.writes.push(next);
    this.stored = next;
    return Promise.resolve();
  }
}

@Component({
  selector: 'lib-saved-views-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      key="id"
      [rowHeight]="40"
      [features]="features()"
      [toolbar]="toolbar()"
    />
  `,
})
class Host {
  readonly columns = signal<readonly ColumnDef<Row>[]>(COLUMNS);
  readonly data = signal<readonly Row[] | GridDataSource<Row>>(ROWS);
  readonly features = signal<readonly DatagridFeature[]>([gridViews({ key: 'test_grid' })]);
  readonly toolbar = signal<ToolbarConfig | null>(null);
}

describe('Datagrid named views', () => {
  let viewportHeight = 400;
  let viewportWidth = 900;

  beforeAll(async () => {
    // The grid reaches the strip by a dynamic import. Loaded once here, so the
    // import inside a test resolves in a microtask and `settle` sees the strip;
    // cold, the transform of the strip and its dialogs outlasts the passes.
    await import('@ui/saved-views');
    globalThis.ResizeObserver = class {
      observe(): void {
        /* layout is stubbed */
      }
      unobserve(): void {
        /* layout is stubbed */
      }
      disconnect(): void {
        /* layout is stubbed */
      }
    };
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: (): number => viewportHeight,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: (): number => viewportWidth,
    });
    // jsdom implements none of the `<dialog>` methods, and the compact form's
    // name editor is one.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
      this.open = true;
    };
    HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement): void {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
      this.open = false;
    };
  });

  beforeEach(() => {
    viewportHeight = 400;
    viewportWidth = 900;
  });

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    for (let pass = 0; pass < 4; pass += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  async function createHost(
    storage: GridViewsStorage,
    data?: GridDataSource<Row>,
    features?: readonly DatagridFeature[],
    columns?: readonly ColumnDef<Row>[],
  ): Promise<ComponentFixture<Host>> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
        provideSavedViewsStorage(storage),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    if (data !== undefined) {
      // Bound before the first render, so the source sees every query the grid
      // has ever issued rather than only the ones after it was swapped in.
      fixture.componentInstance.data.set(data);
    }
    if (features !== undefined) {
      fixture.componentInstance.features.set(features);
    }
    if (columns !== undefined) {
      fixture.componentInstance.columns.set(columns);
    }
    await settle(fixture);
    // A pipe must have transformed before the scope is loaded, or the service
    // caches an empty dictionary under `datagrid/en` forever. The strip's own
    // scope lands with it.
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('datagrid/en'));
    await firstValueFrom(transloco.load('savedViews/en'));
    await settle(fixture);
    return fixture;
  }

  /** The rendered root, typed — `nativeElement` is `any` and the config is strict. */
  function root(fixture: ComponentFixture<Host>): HTMLElement {
    return fixture.debugElement.nativeElement as HTMLElement;
  }

  function grid(fixture: ComponentFixture<Host>): Datagrid<Row> {
    const element = fixture.debugElement.children.at(0);
    if (element == null) {
      throw new Error('grid not rendered');
    }
    return element.componentInstance as Datagrid<Row>;
  }

  // By selector, not by class: the strip is lazy-loaded by the grid, and a
  // static import of it here would be the static import the grid avoids.
  function strip(fixture: ComponentFixture<Host>): {
    controller: () => SavedViewsController<GridState>;
  } {
    const element = fixture.debugElement.query(By.css('lib-saved-views')) as {
      componentInstance: { controller: () => SavedViewsController<GridState> };
    } | null;
    if (element === null) {
      throw new Error('views strip not rendered');
    }
    return element.componentInstance;
  }

  function tabs(fixture: ComponentFixture<Host>): HTMLElement[] {
    return [...root(fixture).querySelectorAll<HTMLElement>('[data-view-id]')];
  }

  // Under the stubbed layout every entry measures zero and the bar reserves
  // its own `clientHeight` for the overflow trigger, so the headroom is
  // `clientWidth - clientHeight` and the cap is arithmetic rather than a guess.
  it('holds itself to the width the bar has left, so the buttons keep theirs', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));

    expect(root(fixture).querySelector<HTMLElement>('lib-saved-views')?.style.maxWidth).toBe(
      '500px',
    );
  });

  // jsdom lays nothing out, so the strip is told it overruns rather than made
  // to: the arithmetic under test is `scrollLeft`, `clientWidth` and
  // `scrollWidth`, and only the last of the three has to be invented.
  function overrun(fixture: ComponentFixture<Host>, width: number): HTMLElement {
    const list = root(fixture).querySelector<HTMLElement>('.sv-tabs');
    if (list === null) {
      throw new Error('views strip not rendered');
    }
    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: width });
    list.dispatchEvent(new Event('scroll'));
    return list;
  }

  function arrows(fixture: ComponentFixture<Host>): HTMLButtonElement[] {
    return [...root(fixture).querySelectorAll<HTMLButtonElement>('.sv-scroll')];
  }

  it('offers no arrows while every view is on screen', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));

    expect(arrows(fixture)).toHaveLength(0);
  });

  it('replaces the scrollbar with a pair of arrows once the strip overruns', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));
    overrun(fixture, 4000);
    await settle(fixture);
    const pair = arrows(fixture);

    expect(pair).toHaveLength(2);
    // Drawn together and dimmed at their own end, so reaching one does not
    // resize the strip under the pointer.
    expect(pair.at(0)?.disabled).toBe(true);
    expect(pair.at(1)?.disabled).toBe(false);
    // Pointer-only, like the same pair in `@ui/tabs`: the keyboard walks the
    // strip with the arrow keys, so a second announced control is noise.
    expect(pair.at(0)?.getAttribute('aria-hidden')).toBe('true');
    expect(pair.at(0)?.tabIndex).toBe(-1);
    expect(getDebugNode(pair.at(0))?.injector.get(Tooltip).libTooltip()).toBe(
      'Scroll views backward',
    );
  });

  it('scrolls by most of a viewport, so what was already read stays as an anchor', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));
    const list = overrun(fixture, 4000);
    await settle(fixture);
    const scrolls: ScrollToOptions[] = [];
    list.scrollBy = (options?: ScrollToOptions | number): void => {
      scrolls.push(options as ScrollToOptions);
    };

    arrows(fixture).at(1)?.click();

    // 900 of viewport, less the fifth kept on screen.
    expect(scrolls.at(0)?.left).toBeCloseTo(720);
    // No `behavior`: the CSS owns it, which is where reduced motion is handled.
    expect(scrolls.at(0)?.behavior).toBeUndefined();
  });

  it('draws the strip from the feature descriptor alone, with no toolbar item named', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));

    const names = tabs(fixture).map(
      (tab) => tab.querySelector<HTMLElement>('.sv-tab-name')?.textContent,
    );
    expect(names).toEqual(['Busy', 'Quiet']);
  });

  it('applies the first view before the first data query goes out', async () => {
    const source = new CountingSource();
    await createHost(new RecordingStorage(document('Busy', 'Quiet')), source);

    // Every query the grid has issued carries the first view's sort. Nothing
    // went out against the unsorted default first.
    const sorts = source.queries.map((query) => query.sort?.[0]?.field);
    expect(sorts.length).toBeGreaterThan(0);
    expect(new Set(sorts)).toEqual(new Set(['city']));
  });

  describe('a temporary view', () => {
    /** Sorted by name, descending: a state no stored view holds. */
    const temporary = (): readonly DatagridFeature[] => [
      gridViews({
        key: 'test_grid',
        temporary: () => ({
          id: 'temporary',
          name: 'Alpha only',
          state: (current) => ({
            ...current,
            columns: current.columns.map((column) =>
              column.id === 'name'
                ? { ...column, sort: { order: 'desc' as const, index: 0 } }
                : { ...column, sort: undefined },
            ),
          }),
        }),
      }),
    ];

    it('is the one state the grid ever queries on a first load, over a stored default', async () => {
      const source = new CountingSource();
      await createHost(new RecordingStorage(document('Busy', 'Quiet')), source, temporary());

      const sorts = source.queries.map((query) => query.sort?.[0]);
      expect(sorts.length).toBeGreaterThan(0);
      expect(sorts.every((sort) => sort?.field === 'name' && sort.desc === true)).toBe(true);
    });

    it('is the one state the grid queries when nothing is stored', async () => {
      const source = new CountingSource();
      await createHost(new RecordingStorage(null), source, temporary());

      expect(source.queries.every((query) => query.sort?.[0]?.desc === true)).toBe(true);
    });

    it('opens on a live grid with one query, and is never written', async () => {
      const source = new CountingSource();
      const storage = new RecordingStorage(document('Busy', 'Quiet'));
      const fixture = await createHost(storage, source);
      const before = source.queries.length;

      grid(fixture)
        .api()
        .openTemporaryView({
          id: 'temporary',
          name: 'Alpha only',
          state: (current) => ({
            ...current,
            columns: current.columns.map((column) => ({
              ...column,
              sort: column.id === 'name' ? { order: 'desc' as const, index: 0 } : undefined,
            })),
          }),
        });
      await settle(fixture);

      expect(source.queries.length - before).toBe(1);
      expect(source.queries.at(-1)?.sort?.[0]).toMatchObject({ field: 'name', desc: true });
      expect(root(fixture).querySelector('[data-temporary-id]')).not.toBeNull();
      expect(storage.writes).toEqual([]);
    });
  });

  it('selects the first view, which is what makes the first the default', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));

    expect(tabs(fixture).at(0)?.getAttribute('aria-selected')).toBe('true');
    expect(tabs(fixture).at(1)?.getAttribute('aria-selected')).toBe('false');
  });

  it('says so when nothing is stored yet, rather than showing an empty strip', async () => {
    const fixture = await createHost(new RecordingStorage(null));

    expect(root(fixture).textContent).toContain('No views created yet');
    expect(tabs(fixture)).toHaveLength(0);
  });

  it('is a tablist of tabs while no name is being edited', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy')));
    const list = root(fixture).querySelector<HTMLElement>('.sv-tabs');

    expect(list?.getAttribute('role')).toBe('tablist');
    expect(tabs(fixture).at(0)?.getAttribute('role')).toBe('tab');
  });

  it('steps the role down while the editor is open, since a tablist holds no text field', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy')));
    strip(fixture).controller().beginRename('view-0');
    await settle(fixture);

    const list = root(fixture).querySelector<HTMLElement>('.sv-tabs');
    expect(list?.getAttribute('role')).toBe('group');
    expect(root(fixture).querySelector('.sv-tab-editor-input')).not.toBeNull();
  });

  it('draws the remove affordance as a pointer-only control, never a second tab stop', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy')));
    const remove = tabs(fixture).at(0)?.querySelector<HTMLElement>('.sv-tab-remove');

    expect(remove?.getAttribute('aria-hidden')).toBe('true');
    expect(remove?.getAttribute('tabindex')).toBe('-1');
  });

  it('keeps one tab stop, so Tab leaves the strip instead of walking it', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet', 'Mine')));

    expect(tabs(fixture).map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('opens the editor seeded with the name it is renaming', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy')));

    strip(fixture).controller().beginRename('view-0');
    await settle(fixture);

    const field = root(fixture).querySelector<HTMLInputElement>('.sv-tab-editor-input');
    expect(field?.value).toBe('Busy');
    // The focus itself is **not** asserted here, and that is a limitation
    // rather than an omission: the editor takes focus from an
    // `afterNextRender` hook, which does not run under this fixture, and jsdom
    // moves `activeElement` only for an element that is in the document.
    // Verified in Chrome instead — create and rename both land focus in the
    // field. The defect it guards against is the `viewChild` trap: with
    // `libInputText` being a component, a bare template-reference query
    // answers the component and `nativeElement` is silently `undefined`.
  });

  it('creates a view holding the arrangement on screen, and writes it', async () => {
    const storage = new RecordingStorage(null);
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();

    controller.beginCreate();
    controller.setEditorName('  Weekly  ');
    controller.commitEditor();
    await settle(fixture);

    expect(tabs(fixture)).toHaveLength(1);
    // Trimmed on the way in: a name of spaces is not a name.
    expect(storage.writes.at(-1)?.views[0]?.name).toBe('Weekly');
    expect(controller.selectedId()).toBe(storage.writes.at(-1)?.views[0]?.id);
  });

  it('refuses a blank name rather than storing one', async () => {
    const storage = new RecordingStorage(null);
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();

    controller.beginCreate();
    controller.setEditorName('   ');
    controller.commitEditor();
    await settle(fixture);

    expect(storage.writes).toHaveLength(0);
    expect(controller.editor()).not.toBeNull();
  });

  it('reports dirty once the arrangement moves away from the saved view', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));
    const controller = strip(fixture).controller();
    expect(controller.dirty()).toBe(false);

    grid(fixture)
      .api()
      .setSort([{ field: 'name' } satisfies SortSpec]);
    await settle(fixture);

    expect(controller.dirty()).toBe(true);
    expect(tabs(fixture).at(0)?.querySelector('.sv-tab-dirty')).not.toBeNull();
    expect(tabs(fixture).at(0)?.getAttribute('aria-describedby')).toContain('dirty');
  });

  // A view outlives the columns it was saved with. It names none of the columns added later,
  // and it can name a column that was removed.
  describe('saved before the columns changed', () => {
    const added = (visible: boolean): ColumnDef<Row> => ({
      id: 'added',
      field: 'name',
      caption: 'Added',
      width: 120,
      visible,
    });

    it('opens unchanged when a hidden column was added since', async () => {
      const fixture = await createHost(
        new RecordingStorage(document('Busy')),
        undefined,
        undefined,
        [...COLUMNS, added(false)],
      );

      expect(strip(fixture).controller().dirty()).toBe(false);
    });

    it('opens unchanged when a shown column was added between two it names', async () => {
      const fixture = await createHost(
        new RecordingStorage(document('Busy')),
        undefined,
        undefined,
        [...COLUMNS.slice(0, 1), added(true), ...COLUMNS.slice(1)],
      );

      expect(strip(fixture).controller().dirty()).toBe(false);
    });

    it('opens unchanged when a column it names was removed', async () => {
      const fixture = await createHost(
        new RecordingStorage(document('Busy')),
        undefined,
        undefined,
        COLUMNS.slice(0, 1),
      );

      expect(strip(fixture).controller().dirty()).toBe(false);
    });

    it('reverts to clean after a change', async () => {
      const fixture = await createHost(
        new RecordingStorage(document('Busy')),
        undefined,
        undefined,
        [...COLUMNS, added(false)],
      );
      const controller = strip(fixture).controller();

      grid(fixture)
        .api()
        .setSort([{ field: 'name' }]);
      await settle(fixture);
      expect(controller.dirty()).toBe(true);

      controller.revertChanges();
      await settle(fixture);
      expect(controller.dirty()).toBe(false);
    });

    // Applying the view clears a sort the view does not hold, so the sort is a change.
    it('reports a sort on a column the view does not name', async () => {
      const fixture = await createHost(
        new RecordingStorage(document('Busy')),
        undefined,
        undefined,
        [...COLUMNS, { ...added(true), field: 'id' }],
      );

      grid(fixture)
        .api()
        .setSort([{ field: 'id' }]);
      await settle(fixture);

      expect(strip(fixture).controller().dirty()).toBe(true);
    });
  });

  it('marks the first view as the default, in a glyph and in words', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));
    const first = tabs(fixture).at(0);
    expect(first?.querySelector('.sv-tab-default')).not.toBeNull();
    expect(tabs(fixture).at(1)?.querySelector('.sv-tab-default')).toBeNull();
    const noteId = first?.getAttribute('aria-describedby') ?? '';
    expect(root(fixture).querySelector(`[id="${noteId}"]`)?.textContent.trim()).toBe(
      'Default view',
    );
  });

  it('moves the star with the default when a view is set as one', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));

    strip(fixture).controller().setDefault('view-1');
    await settle(fixture);

    expect(tabs(fixture).at(0)?.querySelector('.sv-tab-name')?.textContent).toBe('Quiet');
    expect(tabs(fixture).at(0)?.querySelector('.sv-tab-default')).not.toBeNull();
    expect(tabs(fixture).at(1)?.querySelector('.sv-tab-default')).toBeNull();
  });

  it('caps a typed name rather than storing a description', async () => {
    const storage = new RecordingStorage(null);
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();

    controller.beginCreate();
    controller.setEditorName('x'.repeat(400));
    controller.commitEditor();
    await settle(fixture);

    expect(storage.writes.at(-1)?.views[0]?.name).toHaveLength(VIEW_NAME_MAX_LENGTH);
  });

  it('moves save and revert inside the tab and withdraws its × while dirty', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy')));
    const tab = tabs(fixture).at(0);
    expect(tab?.querySelector('.sv-tab-remove')).not.toBeNull();
    expect(tab?.querySelectorAll('.sv-tab-action')).toHaveLength(0);

    grid(fixture)
      .api()
      .setSort([{ field: 'name' }]);
    await settle(fixture);

    const dirtyTab = tabs(fixture).at(0);
    // Delete and save must not both be one press apart on the same tab.
    expect(dirtyTab?.querySelector('.sv-tab-remove')).toBeNull();
    expect(dirtyTab?.querySelectorAll('.sv-tab-action')).toHaveLength(2);
  });

  it('keeps every in-tab affordance out of the a11y tree and out of the tab walk', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy')));
    grid(fixture)
      .api()
      .setSort([{ field: 'name' }]);
    await settle(fixture);

    const actions = [...(tabs(fixture).at(0)?.querySelectorAll<HTMLElement>('button') ?? [])];
    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action.getAttribute('aria-hidden')).toBe('true');
      expect(action.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('saves and reverts from inside the tab', async () => {
    const storage = new RecordingStorage(document('Busy'));
    const fixture = await createHost(storage);
    grid(fixture)
      .api()
      .setSort([{ field: 'name' }]);
    await settle(fixture);

    tabs(fixture).at(0)?.querySelectorAll<HTMLElement>('.sv-tab-action')[0]?.click();
    await settle(fixture);

    expect(strip(fixture).controller().dirty()).toBe(false);
    expect(storage.writes).toHaveLength(1);
  });

  it('carries the dirty fact as text, never as the asterisk alone', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy')));
    grid(fixture)
      .api()
      .setSort([{ field: 'name' }]);
    await settle(fixture);

    // Two facts can be true of one tab, so the descriptions are composed
    // rather than one overwriting the other.
    const ids = (tabs(fixture).at(0)?.getAttribute('aria-describedby') ?? '').split(' ');
    const notes = ids
      .map((id) => root(fixture).querySelector<HTMLElement>(`[id="${id}"]`)?.textContent.trim())
      .filter((text) => text !== undefined);
    expect(notes).toContain('Unsaved changes');
    expect(notes).toContain('Default view');
  });

  it('saves the arrangement into the selected view and settles the dirty state', async () => {
    const storage = new RecordingStorage(document('Busy', 'Quiet'));
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();

    grid(fixture)
      .api()
      .setSort([{ field: 'name' }]);
    await settle(fixture);
    controller.saveChanges();
    await settle(fixture);

    expect(controller.dirty()).toBe(false);
    expect(
      storage.writes.at(-1)?.views[0]?.state.columns.find((column) => column.id === 'name')?.sort,
    ).toEqual({ order: 'asc', index: 0 });
  });

  it('reverts to what was saved, which puts the grid back with it', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));
    const controller = strip(fixture).controller();

    grid(fixture)
      .api()
      .setSort([{ field: 'name' }]);
    await settle(fixture);
    controller.revertChanges();
    await settle(fixture);

    expect(controller.dirty()).toBe(false);
    expect(
      grid(fixture)
        .api()
        .getState()
        .columns.find((column) => column.id === 'city')?.sort,
    ).toEqual({
      order: 'asc',
      index: 0,
    });
  });

  it('switches view silently, dropping unsaved changes to the one being left', async () => {
    const storage = new RecordingStorage(document('Busy', 'Quiet'));
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();

    grid(fixture)
      .api()
      .setSort([{ field: 'name' }]);
    await settle(fixture);
    controller.select('view-1');
    await settle(fixture);

    expect(controller.selectedId()).toBe('view-1');
    expect(controller.dirty()).toBe(false);
    // The abandoned changes were never written.
    expect(storage.writes).toHaveLength(0);
  });

  it('makes a view default by moving it to the front', async () => {
    const storage = new RecordingStorage(document('Busy', 'Quiet'));
    const fixture = await createHost(storage);

    strip(fixture).controller().setDefault('view-1');
    await settle(fixture);

    expect(storage.writes.at(-1)?.views.map((view) => view.id)).toEqual(['view-1', 'view-0']);
  });

  it('falls through to the new first view when the selected one is removed', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));
    const controller = strip(fixture).controller();

    controller.remove('view-0');
    await settle(fixture);

    expect(controller.selectedId()).toBe('view-1');
    expect(tabs(fixture)).toHaveLength(1);
  });

  it('leaves the grid alone when the last view is removed', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy')));
    const controller = strip(fixture).controller();
    const before = grid(fixture).api().getState();

    controller.remove('view-0');
    await settle(fixture);

    expect(controller.selectedId()).toBeNull();
    expect(grid(fixture).api().getState()).toEqual(before);
    expect(root(fixture).textContent).toContain('No views created yet');
  });

  it('renames without touching the arrangement of a view that is not on screen', async () => {
    const storage = new RecordingStorage(document('Busy', 'Quiet'));
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();

    // The grid shows view-0, sorted by city. Renaming view-1 must not copy
    // that arrangement into it.
    grid(fixture)
      .api()
      .setSort([{ field: 'name' }]);
    await settle(fixture);
    controller.beginRename('view-1');
    controller.setEditorName('Renamed');
    controller.commitEditor();
    await settle(fixture);

    const written = storage.writes.at(-1)?.views[1];
    expect(written?.name).toBe('Renamed');
    expect(written?.state).toEqual(stateSortedBy('name'));
  });

  it('rolls the strip back when a write fails, so nothing looks saved that was not', async () => {
    const storage = new RecordingStorage(document('Busy', 'Quiet'));
    storage.failSave = true;
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();

    controller.setDefault('view-1');
    await settle(fixture);

    expect(controller.views().map((view) => view.id)).toEqual(['view-0', 'view-1']);
    expect(controller.status()).toBe('error');
    expect(root(fixture).textContent).toContain('could not be saved');
  });

  it('rolls the selection back too, so it cannot point at a view that was rolled out', async () => {
    const storage = new RecordingStorage(document('Busy', 'Quiet'));
    storage.failSave = true;
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();

    controller.duplicate('view-0');
    await settle(fixture);

    expect(controller.views().map((view) => view.id)).toEqual(['view-0', 'view-1']);
    expect(controller.selectedId()).toBe('view-0');
  });

  it('rolls a failed reorder back to the order the drag started from', async () => {
    const storage = new RecordingStorage(document('Busy', 'Quiet', 'Mine'));
    const fixture = await createHost(storage);
    const controller = strip(fixture).controller();
    storage.failSave = true;

    // Two live swaps, as a drag across two tabs performs them.
    controller.previewMove('view-0', 1);
    controller.previewMove('view-0', 2);
    controller.commitOrder();
    await settle(fixture);

    expect(controller.views().map((view) => view.id)).toEqual(['view-0', 'view-1', 'view-2']);
  });

  it('reorders from the keyboard, so the strip is not pointer-only', async () => {
    const storage = new RecordingStorage(document('Busy', 'Quiet'));
    const fixture = await createHost(storage);
    const first = tabs(fixture).at(0);
    if (first == null) {
      throw new Error('tab not rendered');
    }

    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true }),
    );
    await settle(fixture);

    expect(storage.writes.at(-1)?.views.map((view) => view.id)).toEqual(['view-1', 'view-0']);
  });

  it('does not select under arrow navigation, because a switch costs a query', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));
    const controller = strip(fixture).controller();
    const first = tabs(fixture).at(0);

    first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle(fixture);

    expect(controller.selectedId()).toBe('view-0');
  });

  it('selects on Enter', async () => {
    const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));
    const controller = strip(fixture).controller();

    tabs(fixture)
      .at(1)
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);

    expect(controller.selectedId()).toBe('view-1');
  });
  // The compact form. The bar publishes what it has left, and the strip reads
  // it — so a narrow bar here is a narrow `clientWidth`, not a media query.
  describe('below the width the strip needs', () => {
    /** Under the stubbed layout the bar reserves its own height for the trigger. */
    const NARROW = 600;

    function combobox(fixture: ComponentFixture<Host>): HTMLElement {
      const element = root(fixture).querySelector<HTMLElement>('[role="combobox"]');
      if (element === null) {
        throw new Error('views listbox not rendered');
      }
      return element;
    }

    function options(fixture: ComponentFixture<Host>): HTMLElement[] {
      return [...root(fixture).querySelectorAll<HTMLElement>('[role="option"]')];
    }

    async function open(fixture: ComponentFixture<Host>): Promise<HTMLElement[]> {
      const trigger = combobox(fixture);
      trigger.focus();
      trigger.click();
      await settle(fixture);
      return options(fixture);
    }

    async function createNarrowHost(storage: GridViewsStorage): Promise<ComponentFixture<Host>> {
      viewportWidth = NARROW;
      return await createHost(storage);
    }

    // The strip yields; this form does not. Its field is a fixed `11rem` and the
    // menu button drawn over it is spent before the first character, so there is
    // nothing left to give — the floor covers the field plus the unsaved pair.
    it('holds its floor rather than taking the little the bar has left', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy')));

      expect(root(fixture).querySelector<HTMLElement>('lib-saved-views')?.style.maxWidth).toBe(
        '260px',
      );
    });

    it('keeps that floor when the buttons alone overrun the bar', async () => {
      // No headroom at all here. Below the floor the answer is the overflow
      // surface, not a field one glyph wide: `used` exceeds the budget and the
      // bar collapses its `auto` entries.
      viewportWidth = 500;
      const fixture = await createHost(new RecordingStorage(document('Busy')));

      expect(root(fixture).querySelector<HTMLElement>('lib-saved-views')?.style.maxWidth).toBe(
        '260px',
      );
    });

    it('draws a listbox instead of the strip', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy', 'Quiet')));

      expect(root(fixture).querySelector('[role="tablist"]')).toBeNull();
      expect(combobox(fixture).textContent).toContain('Busy');
    });

    it('still offers the menu with no view to act on, so the field is never bare', async () => {
      // Narrower than `NARROW`: with no view at all the strip is one button
      // wide, so it takes a bar with no room for that to reach this form.
      viewportWidth = 400;
      const fixture = await createHost(new RecordingStorage(document()));

      // A second pass: the dictionary behind the placeholder is a lazy scope,
      // and the pipe re-renders when it lands.
      await settle(fixture);

      expect(root(fixture).querySelector('.sv-select')).not.toBeNull();
      expect(combobox(fixture).textContent).toContain('No views yet');
      expect(root(fixture).querySelector('.sv-menu-trigger')).not.toBeNull();
    });

    it('keeps the strip while the bar still has room for it', async () => {
      const fixture = await createHost(new RecordingStorage(document('Busy', 'Quiet')));

      expect(root(fixture).querySelector('[role="tablist"]')).not.toBeNull();
      expect(root(fixture).querySelector('.sv-select')).toBeNull();
    });

    it('opens with the row that adds a view, before any view', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy', 'Quiet')));

      const labels = (await open(fixture)).map((option) => option.textContent.trim());
      expect(labels).toEqual(['Create view', 'Busy', 'Quiet']);
    });

    it('selects a view from the listbox', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy', 'Quiet')));
      const controller = strip(fixture).controller();

      (await open(fixture)).at(2)?.click();
      await settle(fixture);

      expect(controller.selectedId()).toBe('view-1');
    });

    it('opens the editor from the add row, and puts the field back to the view it was showing', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy')));
      const controller = strip(fixture).controller();

      (await open(fixture)).at(0)?.click();
      await settle(fixture);

      expect(controller.editor()).toEqual({ mode: 'create', id: null, name: '' });
      // The row is a command, not a value: leaving it selected would report a
      // view named "Create view" for as long as the editor stayed open.
      expect(combobox(fixture).textContent).toContain('Busy');
    });

    it('names the editor for what it does', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy')));
      const controller = strip(fixture).controller();

      controller.beginRename('view-0');
      await settle(fixture);

      const dialog = root(fixture).querySelector('dialog');
      expect(dialog?.textContent).toContain('Rename view');
      expect(dialog?.querySelector<HTMLInputElement>('input')?.value).toBe('Busy');
    });

    it('offers the per-view menu from a button, since a combobox holds no controls', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy')));

      const trigger = root(fixture).querySelector<HTMLButtonElement>('.sv-menu-trigger');
      expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger?.disabled).toBe(false);
      expect(combobox(fixture).querySelector('button')).toBeNull();
    });

    it('offers a new view from the menu, so the add row is not the only way in', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(null));
      const trigger = root(fixture).querySelector<HTMLButtonElement>('.sv-menu-trigger');

      // Live with no view at all: the create row is the one thing the menu can
      // always offer, and a disabled button here would strand an empty grid.
      expect(trigger?.disabled).toBe(false);
      trigger?.click();
      await settle(fixture);

      expect(
        [...globalThis.document.querySelectorAll('[role="menuitem"]')].map((item) =>
          item.textContent.trim(),
        ),
      ).toEqual(['Create view']);
    });

    it('keeps the unsaved pair out of the menu, where the strip keeps it in the tab', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy')));
      const labelOf = (element: Element): string | null => element.getAttribute('aria-label');
      expect([...root(fixture).querySelectorAll('button')].map(labelOf)).not.toContain(
        'Save changes',
      );

      grid(fixture)
        .api()
        .setSort([{ field: 'name' } satisfies SortSpec]);
      await settle(fixture);

      expect([...root(fixture).querySelectorAll('button')].map(labelOf)).toContain('Save changes');
    });

    it('describes the trigger with the same notes the tabs point at', async () => {
      const fixture = await createNarrowHost(new RecordingStorage(document('Busy')));
      const described = combobox(fixture).getAttribute('aria-describedby');

      expect(described).not.toBeNull();
      expect(
        root(fixture)
          .querySelector(`#${described ?? ''}`)
          ?.textContent.trim(),
      ).toBe('Default view');
    });
  });
});
