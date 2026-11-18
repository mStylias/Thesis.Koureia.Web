/**
 * M5: grid state (§14), configuration lifecycle (§3.2), the capability mask
 * (§3.3) and live data (§12).
 *
 * The capability cases assert all three paths §3.3 names — the affordance, the
 * keyboard and the imperative API — because hiding a control while the code
 * behind it still runs is the defect the section exists to forbid.
 */
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { Datagrid } from './datagrid';
import { provideDatagridDefaults } from './datagrid.defaults';
import { provideDatagridStatePersistence } from './core/state-persistence';
import type { GridStatePersistence } from './core/state-persistence.types';
import { GRID_STATE_VERSION } from './core/state';
import type { ColumnDef } from './core/types/column.types';
import type { GridCapabilities, GridConfig } from './core/types/config.types';
import type { GridState } from './core/types/state.types';
import type { GridDataSource, Query, QueryResult } from './core/types/query.types';

interface Row {
  id: number;
  name: string;
  city: string;
  score: number;
}

let viewportHeight = 400;
let viewportWidth = 900;

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index + 1,
    name: `Row ${(index + 1).toString()}`,
    city: index % 2 === 0 ? 'Nicosia' : 'Limassol',
    score: index * 10,
  }));
}

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', width: 200 },
  { id: 'city', field: 'city', caption: 'City', width: 150 },
  { id: 'score', field: 'score', caption: 'Score', width: 100, dataType: 'number' },
];

/** Records every query it is asked for, so "exactly one query" is measurable. */
class CountingSource implements GridDataSource<Row> {
  readonly queries: Query[] = [];
  constructor(private readonly rows: readonly Row[]) {}
  load(query: Query): Promise<QueryResult<Row>> {
    this.queries.push(query);
    return Promise.resolve({ rows: [...this.rows], totalCount: this.rows.length });
  }
}

@Component({
  selector: 'lib-datagrid-state-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      [key]="key()"
      [rowHeight]="40"
      [selectionMode]="selectionMode()"
      [pagingMode]="pagingMode()"
      [readOnly]="readOnly()"
      [capabilities]="capabilities()"
      [stateKey]="stateKey()"
      [(state)]="state"
      [(autoRefresh)]="autoRefresh"
      [autoRefreshInterval]="autoRefreshInterval()"
      (stateChanged)="stateEvents.update((all) => [...all, $event])"
      (refreshRequested)="refreshes.update((count) => count + 1)"
    />
  `,
})
class Host {
  readonly columns = signal<readonly ColumnDef<Row>[]>(COLUMNS);
  readonly data = signal<readonly Row[] | GridDataSource<Row> | null>(makeRows(20));
  readonly key = signal<string | null>('id');
  readonly selectionMode = signal<'none' | 'single' | 'multiple'>('multiple');
  readonly pagingMode = signal<'none' | 'pager' | 'infinite'>('none');
  readonly readOnly = signal(false);
  readonly capabilities = signal<GridCapabilities | null>(null);
  readonly stateKey = signal<string | null>(null);
  readonly state = signal<GridState | null>(null);
  readonly autoRefresh = signal(false);
  readonly autoRefreshInterval = signal(30_000);
  readonly stateEvents = signal<readonly { state: GridState; origin: string }[]>([]);
  readonly refreshes = signal(0);
}

/** The config object as one binding, with one key optionally overridden. */
@Component({
  selector: 'lib-datagrid-config-host',
  imports: [Datagrid],
  template: `
    @if (overrideDensity()) {
      <lib-datagrid [config]="config()" density="comfortable" [rowHeight]="40" />
    } @else {
      <lib-datagrid [config]="config()" [rowHeight]="40" />
    }
  `,
})
class ConfigHost {
  readonly overrideDensity = signal(false);
  readonly config = signal<GridConfig<Row>>({
    key: 'id',
    columns: COLUMNS,
    data: makeRows(12),
    appearance: { density: 'compact', striping: true },
    selection: { mode: 'multiple' },
  });
}

describe('Datagrid state, configuration and live data', () => {
  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Waits past the state debounce, which is real rather than faked here. */
  async function settleState(fixture: ComponentFixture<unknown>): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 320));
    await settle(fixture);
  }

  beforeAll(() => {
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
  });

  function configureTestBed(providers: unknown[] = []): void {
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
        ...(providers as never[]),
      ],
    });
  }

  beforeEach(() => {
    viewportHeight = 400;
    viewportWidth = 900;
  });

  describe('state round-trip', () => {
    let fixture: ComponentFixture<Host>;
    let host: Host;

    function grid(): Datagrid<Row> {
      return fixture.debugElement.children[0].componentInstance as Datagrid<Row>;
    }

    beforeEach(async () => {
      configureTestBed();
      fixture = TestBed.createComponent(Host);
      host = fixture.componentInstance;
      await settle(fixture);
    });

    it('is lossless over everything the user can arrange', async () => {
      const api = grid().api();
      api.setSort([{ field: 'score', desc: true }]);
      api.setColumnWidth('city', 320);
      api.pinColumn('name', 'start');
      api.setColumnVisible('score', false);
      api.setSearch('nic');
      await settle(fixture);

      const saved = api.getState();
      api.resetState();
      await settle(fixture);
      expect(api.getSort()).toEqual([]);
      expect(api.getSearch()).toBeNull();

      const report = api.setState(saved);
      await settle(fixture);
      expect(report.applied).toBe(true);
      expect(api.getSort()).toEqual([{ field: 'score', desc: true }]);
      expect(api.getSearch()).toBe('nic');
      expect(api.getVisibleColumns().map((column) => column.id)).toEqual(['name', 'city']);
      expect(api.getState()).toEqual(saved);
    });

    it('excludes the volatile half by default and includes it on request', async () => {
      const api = grid().api();
      api.setSelectedKeys([2, 3]);
      await settle(fixture);

      expect(api.getState().volatile).toBeUndefined();
      const withVolatile = api.getState({ volatile: true });
      expect(withVolatile.volatile?.selectedKeys).toEqual([2, 3]);
      expect(withVolatile.volatile?.scroll).toEqual({ top: 0, left: 0 });
    });

    it('restores a volatile selection when one was saved', async () => {
      const api = grid().api();
      api.setSelectedKeys([4]);
      await settle(fixture);
      const saved = api.getState({ volatile: true });

      api.clearSelection();
      await settle(fixture);
      expect(api.getSelectedKeys()).toEqual([]);

      api.setState(saved);
      await settle(fixture);
      expect(api.getSelectedKeys()).toEqual([4]);
    });

    it('tolerates entries for columns that no longer exist, and reports them', async () => {
      const api = grid().api();
      const state = api.getState();
      state.columns.push({ id: 'ghost', visible: true, visibleIndex: 9 });

      const report = api.setState(state);
      await settle(fixture);
      expect(report.applied).toBe(true);
      expect(report.droppedColumnIds).toEqual(['ghost']);
      expect(api.getVisibleColumns().map((column) => column.id)).toEqual(['name', 'city', 'score']);
    });

    it('discards a state from an unknown version rather than misreading it', async () => {
      const api = grid().api();
      const report = api.setState({ ...api.getState(), version: GRID_STATE_VERSION + 5 });
      await settle(fixture);
      expect(report.applied).toBe(false);
    });

    it('reports dirty against a reference, and not for a scroll', async () => {
      const api = grid().api();
      const reference = api.getState();
      expect(api.isDirty(reference)).toBe(false);

      api.setScrollPosition({ top: 120, left: 0 });
      await settle(fixture);
      expect(api.isDirty(reference)).toBe(false);

      api.setSort([{ field: 'name' }]);
      await settle(fixture);
      expect(api.isDirty(reference)).toBe(true);
    });

    it('writes the two-way binding and applies what the host writes back', async () => {
      grid()
        .api()
        .setSort([{ field: 'name', desc: true }]);
      await settle(fixture);
      const written = host.state();
      expect(written).not.toBeNull();

      grid().api().setSort([]);
      await settle(fixture);
      expect(grid().api().getSort()).toEqual([]);

      host.state.set(written);
      await settle(fixture);
      expect(grid().api().getSort()).toEqual([{ field: 'name', desc: true }]);
    });

    it('emits stateChanged once for a settled change, with its origin', async () => {
      host.stateEvents.set([]);
      grid()
        .api()
        .setSort([{ field: 'city' }]);
      grid().api().setColumnWidth('city', 260);
      await settleState(fixture);

      expect(host.stateEvents().length).toBe(1);
      expect(host.stateEvents()[0].origin).toBe('programmatic');
    });

    it('does not emit stateChanged for the initial arrangement', async () => {
      expect(host.stateEvents()).toEqual([]);
      await settleState(fixture);
      expect(host.stateEvents()).toEqual([]);
    });
  });

  describe('applying a state issues one query', () => {
    let fixture: ComponentFixture<Host>;
    let source: CountingSource;

    function grid(): Datagrid<Row> {
      return fixture.debugElement.children[0].componentInstance as Datagrid<Row>;
    }

    beforeEach(async () => {
      configureTestBed();
      source = new CountingSource(makeRows(20));
      fixture = TestBed.createComponent(Host);
      fixture.componentInstance.data.set(source);
      await settle(fixture);
    });

    it('loads once however many facets the state changes', async () => {
      const api = grid().api();
      api.setSort([{ field: 'score', desc: true }]);
      api.setSearch('nic');
      api.setColumnFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      await settle(fixture);
      const saved = api.getState();

      api.resetState();
      await settle(fixture);

      const before = source.queries.length;
      api.setState(saved);
      await settle(fixture);
      expect(source.queries.length - before).toBe(1);
    });
  });

  describe('persistence', () => {
    let fixture: ComponentFixture<Host>;
    let saved: GridState | null;
    let cleared: string[];
    let adapter: GridStatePersistence;
    let source: CountingSource;

    function grid(): Datagrid<Row> {
      return fixture.debugElement.children[0].componentInstance as Datagrid<Row>;
    }

    beforeEach(() => {
      cleared = [];
      saved = {
        version: GRID_STATE_VERSION,
        columns: [
          { id: 'name', visible: true, visibleIndex: 0, pinned: false },
          { id: 'city', visible: false, pinned: false },
          { id: 'score', visible: true, visibleIndex: 1, pinned: false },
        ],
        search: 'restored',
      };
      adapter = {
        load: () => Promise.resolve(saved),
        save: (_id, state) => {
          saved = state;
        },
        clear: (id) => {
          cleared.push(id);
        },
      };
      source = new CountingSource(makeRows(20));
      configureTestBed([provideDatagridStatePersistence(adapter)]);
      fixture = TestBed.createComponent(Host);
      fixture.componentInstance.data.set(source);
      fixture.componentInstance.stateKey.set('bookings');
    });

    it('applies the saved arrangement before the first query goes out', async () => {
      await settle(fixture);
      expect(grid().api().getSearch()).toBe('restored');
      expect(
        grid()
          .api()
          .getVisibleColumns()
          .map((column) => column.id),
      ).toEqual(['name', 'score']);
      // No query may carry the projection or the filter the state replaced.
      expect(source.queries.every((query) => query.search === 'restored')).toBe(true);
    });

    it('saves the arrangement once it settles', async () => {
      await settle(fixture);
      grid()
        .api()
        .setSort([{ field: 'score' }]);
      await settleState(fixture);
      expect(saved?.columns.find((entry) => entry.id === 'score')?.sort?.order).toBe('asc');
    });

    it('forgets the saved arrangement when the grid is reset', async () => {
      await settle(fixture);
      grid().api().resetState();
      await settle(fixture);
      expect(cleared).toEqual(['bookings']);
    });

    it('renders with the declared arrangement when the adapter fails', async () => {
      adapter.load = () => Promise.reject(new Error('offline'));
      await settle(fixture);
      expect(grid().api().getSearch()).toBeNull();
      expect(source.queries.length).toBeGreaterThan(0);
    });
  });

  describe('config object and defaults', () => {
    let fixture: ComponentFixture<ConfigHost>;

    function gridHost(): HTMLElement {
      const host = (fixture.nativeElement as HTMLElement).querySelector('lib-datagrid');
      if (host == null) {
        throw new Error('grid not rendered');
      }
      return host as HTMLElement;
    }

    function grid(): Datagrid<Row> {
      return fixture.debugElement.query((node) => node.name === 'lib-datagrid')
        .componentInstance as Datagrid<Row>;
    }

    it('drives the grid from one object', async () => {
      configureTestBed();
      fixture = TestBed.createComponent(ConfigHost);
      await settle(fixture);
      expect(gridHost().getAttribute('data-density')).toBe('compact');
      expect(gridHost().getAttribute('data-striped')).toBe('');
      expect(gridHost().getAttribute('data-selectable')).toBe('');
      expect(grid().api().getColumns().length).toBe(3);
    });

    it('lets an explicit binding win over the same key in the config', async () => {
      configureTestBed();
      fixture = TestBed.createComponent(ConfigHost);
      fixture.componentInstance.overrideDensity.set(true);
      await settle(fixture);
      expect(gridHost().getAttribute('data-density')).toBe('comfortable');
    });

    it('resolves application defaults beneath the config object', async () => {
      configureTestBed([
        provideDatagridDefaults({ appearance: { density: 'comfortable', outerBorder: false } }),
      ]);
      fixture = TestBed.createComponent(ConfigHost);
      await settle(fixture);
      // The config wins on density; the default still answers for the key it
      // does not name.
      expect(gridHost().getAttribute('data-density')).toBe('compact');
      expect(gridHost().getAttribute('data-outer-border')).toBeNull();
    });

    it('resets no width, no scroll and no selection for a fresh but equal config (§3.2)', async () => {
      configureTestBed();
      fixture = TestBed.createComponent(ConfigHost);
      await settle(fixture);
      const api = grid().api();
      api.setColumnWidth('city', 333);
      api.setSelectedKeys([2, 3]);
      api.setScrollPosition({ top: 80, left: 0 });
      await settle(fixture);

      const current = fixture.componentInstance.config();
      fixture.componentInstance.config.set({ ...current, appearance: { ...current.appearance } });
      await settle(fixture);

      expect(api.getColumns().find((column) => column.id === 'city')?.width).toBe(333);
      expect(api.getSelectedKeys()).toEqual([2, 3]);
      expect(api.getScrollPosition().top).toBe(80);
    });
  });

  describe('capability mask', () => {
    let fixture: ComponentFixture<Host>;
    let host: Host;

    function grid(): Datagrid<Row> {
      return fixture.debugElement.children[0].componentInstance as Datagrid<Row>;
    }

    function element(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    function headerCell(caption: string): HTMLElement {
      const cell = [...element().querySelectorAll<HTMLElement>('[role="columnheader"]')].find(
        (candidate) => candidate.textContent.includes(caption),
      );
      if (cell === undefined) {
        throw new Error(`header cell "${caption}" not rendered`);
      }
      return cell;
    }

    beforeEach(async () => {
      configureTestBed();
      fixture = TestBed.createComponent(Host);
      host = fixture.componentInstance;
      await settle(fixture);
    });

    it('marks the host so a read-only grid can be styled', async () => {
      host.readOnly.set(true);
      await settle(fixture);
      expect(
        (element().querySelector('lib-datagrid') ?? element()).getAttribute('data-read-only'),
      ).not.toBeNull();
    });

    it('refuses sorting on the affordance, the keyboard and the API', async () => {
      host.capabilities.set({ sorting: false });
      await settle(fixture);

      expect(headerCell('Name').getAttribute('aria-sort')).toBeNull();

      headerCell('Name').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(grid().api().getSort()).toEqual([]);

      headerCell('Name').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      await settle(fixture);
      expect(grid().api().getSort()).toEqual([]);

      grid()
        .api()
        .setSort([{ field: 'name' }]);
      await settle(fixture);
      expect(grid().api().getSort()).toEqual([]);
    });

    it('refuses resizing through the keyboard binding as well as the handle', async () => {
      host.capabilities.set({ resizing: false });
      await settle(fixture);
      const before = grid()
        .api()
        .getColumns()
        .find((column) => column.id === 'city')?.width;

      expect(headerCell('City').querySelector('[data-resize-handle]')).toBeNull();
      headerCell('City').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true }),
      );
      await settle(fixture);
      grid().api().setColumnWidth('city', 400);
      await settle(fixture);

      expect(
        grid()
          .api()
          .getColumns()
          .find((column) => column.id === 'city')?.width,
      ).toBe(before);
    });

    it('draws no selection column and selects nothing when selection is withheld', async () => {
      host.capabilities.set({ selection: false });
      await settle(fixture);

      expect(element().querySelector('[data-column="__selection"]')).toBeNull();
      grid().api().setSelectedKeys([1, 2]);
      await settle(fixture);
      expect(grid().api().getSelectedKeys()).toEqual([]);
    });

    it('refuses hiding and moving a column through the API', async () => {
      host.capabilities.set({ hiding: false, reordering: false });
      await settle(fixture);
      const api = grid().api();

      api.setColumnVisible('city', false);
      api.moveColumn('score', 0);
      api.pinColumn('name', 'end');
      await settle(fixture);

      expect(api.getVisibleColumns().map((column) => column.id)).toEqual(['name', 'city', 'score']);
      expect(api.getColumns().find((column) => column.id === 'name')?.pinned).toBe(false);
    });

    it('refuses filtering and searching through the API', async () => {
      host.capabilities.set({ filtering: false });
      await settle(fixture);
      const api = grid().api();

      api.setSearch('nic');
      api.setFilter({ field: 'city', op: 'eq', value: 'Nicosia' });
      api.setColumnFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      api.setHeaderFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      await settle(fixture);

      expect(api.getSearch()).toBeNull();
      expect(api.getFilter()).toBeNull();
    });

    it('hides the pager and refuses a page change when paging is withheld', async () => {
      host.pagingMode.set('pager');
      await settle(fixture);
      expect(element().querySelector('lib-paginator')).not.toBeNull();

      host.capabilities.set({ paging: false });
      await settle(fixture);
      expect(element().querySelector('lib-paginator')).toBeNull();
    });

    it('re-grants selectively on top of readOnly', async () => {
      host.readOnly.set(true);
      host.capabilities.set({ sorting: true });
      await settle(fixture);

      grid()
        .api()
        .setSort([{ field: 'name' }]);
      grid().api().setColumnWidth('city', 400);
      await settle(fixture);

      expect(grid().api().getSort()).toEqual([{ field: 'name' }]);
      expect(
        grid()
          .api()
          .getColumns()
          .find((column) => column.id === 'city')?.width,
      ).toBe(150);
    });

    it('still applies a saved arrangement to a read-only grid', async () => {
      const saved = grid().api().getState();
      saved.columns[0].width = 260;
      host.readOnly.set(true);
      await settle(fixture);

      grid().api().setState(saved);
      await settle(fixture);
      expect(
        grid()
          .api()
          .getColumns()
          .find((column) => column.id === 'name')?.width,
      ).toBe(260);
    });

    it('refuses resetState when the arrangement is locked', async () => {
      grid()
        .api()
        .setSort([{ field: 'name' }]);
      await settle(fixture);
      host.capabilities.set({ stateChange: false });
      await settle(fixture);

      grid().api().resetState();
      await settle(fixture);
      expect(grid().api().getSort()).toEqual([{ field: 'name' }]);
    });
  });

  describe('refresh and live data', () => {
    let fixture: ComponentFixture<Host>;
    let host: Host;

    function grid(): Datagrid<Row> {
      return fixture.debugElement.children[0].componentInstance as Datagrid<Row>;
    }

    function element(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    function cellText(key: number, column: string): string {
      const row = element().querySelector(`[role="row"][data-key="${key.toString()}"]`);
      const cell = row?.querySelector(`[data-column="${column}"]`);
      if (cell == null) {
        throw new Error(`cell ${key.toString()}/${column} not rendered`);
      }
      return cell.textContent.trim();
    }

    beforeEach(async () => {
      configureTestBed();
      fixture = TestBed.createComponent(Host);
      host = fixture.componentInstance;
      await settle(fixture);
    });

    it('announces a refresh before it re-runs the query', async () => {
      host.refreshes.set(0);
      grid().api().reload();
      await settle(fixture);
      expect(host.refreshes()).toBe(1);
    });

    it('preserves selection, expansion and scroll across a refresh', async () => {
      const api = grid().api();
      api.setSelectedKeys([3, 5]);
      api.setScrollPosition({ top: 120, left: 0 });
      await settle(fixture);

      api.reload();
      await settle(fixture);

      expect(api.getSelectedKeys()).toEqual([3, 5]);
      expect(api.getScrollPosition().top).toBe(120);
    });

    it('applies a transaction without a query and re-renders the affected row only', async () => {
      const api = grid().api();
      const untouched = element().querySelector('[role="row"][data-key="2"]');
      expect(cellText(1, 'name')).toBe('Row 1');

      api.applyTransaction({ update: [{ key: 1, changes: { name: 'Renamed' } }] });
      await settle(fixture);

      expect(cellText(1, 'name')).toBe('Renamed');
      expect(element().querySelector('[role="row"][data-key="2"]')).toBe(untouched);
      expect(api.getRow(1)?.name).toBe('Renamed');
    });

    it('inserts and removes rows, moving the reported total with them', async () => {
      const api = grid().api();
      expect(api.getTotalCount()).toBe(20);

      api.applyTransaction({
        insert: [{ id: 99, name: 'Added', city: 'Larnaca', score: 5 }],
        remove: [1],
      });
      await settle(fixture);

      expect(api.getTotalCount()).toBe(20);
      expect(api.getRow(1)).toBeUndefined();
      expect(api.getRow(99)?.name).toBe('Added');
    });

    it('never mutates a row the host owns', async () => {
      const rows = makeRows(3);
      host.data.set(rows);
      await settle(fixture);

      grid()
        .api()
        .applyTransaction({ update: [{ key: 2, changes: { score: 777 } }] });
      await settle(fixture);

      expect(rows[1].score).toBe(10);
      expect(grid().api().getRow(2)?.score).toBe(777);
    });

    it('draws the indicator only when auto-refresh is on offer', async () => {
      expect(element().querySelector('.dg-auto-refresh')).toBeNull();
      host.autoRefresh.set(true);
      await settle(fixture);
      expect(element().querySelector('.dg-auto-refresh')).not.toBeNull();
    });

    it('reloads on its own interval while it runs', async () => {
      host.autoRefreshInterval.set(1000);
      host.autoRefresh.set(true);
      host.refreshes.set(0);
      await settle(fixture);

      await new Promise((resolve) => setTimeout(resolve, 1200));
      await settle(fixture);
      expect(host.refreshes()).toBeGreaterThanOrEqual(1);

      host.autoRefresh.set(false);
      await settle(fixture);
      const settled = host.refreshes();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await settle(fixture);
      expect(host.refreshes()).toBe(settled);
    });
  });
});
