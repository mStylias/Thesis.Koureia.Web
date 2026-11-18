/**
 * The imperative API (§19.2) and the neutral shell (§3.2).
 *
 * The API is asserted through rendered output wherever it produces any: a
 * method that only moved a store would pass a test that a broken render still
 * fails.
 */
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { Datagrid } from './datagrid';
import { GRID_STATE_VERSION } from './core/state';
import type { ColumnDef } from './core/types/column.types';
import type { FilterNode } from './core/types/filter.types';
import type { GridState } from './core/types/state.types';

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
  { id: 'score', field: 'score', caption: 'Score', width: 100 },
];

@Component({
  selector: 'lib-datagrid-api-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      [key]="key()"
      [rowHeight]="40"
      [selectionMode]="'multiple'"
      [baseFilter]="baseFilter()"
      [pagingMode]="pagingMode()"
      [(pageSize)]="pageSize"
      [requireTotalCount]="requireTotalCount()"
      [(hiddenColumns)]="hiddenColumns"
      (gridEvent)="events.update((all) => [...all, $event.name])"
    />
  `,
})
class Host {
  readonly columns = signal<readonly ColumnDef<Row>[]>(COLUMNS);
  readonly data = signal<readonly Row[] | null>(makeRows(20));
  readonly key = signal<string | null>('id');
  readonly hiddenColumns = signal<readonly string[]>([]);
  readonly baseFilter = signal<FilterNode | null>(null);
  readonly pagingMode = signal<'none' | 'pager' | 'infinite'>('none');
  readonly pageSize = signal(50);
  readonly requireTotalCount = signal(true);
  readonly events = signal<readonly string[]>([]);
}

/** The grid with nothing bound at all, which §19.1 requires to compile. */
@Component({
  selector: 'lib-datagrid-bare-host',
  imports: [Datagrid],
  template: `<lib-datagrid />`,
})
class BareHost {}

describe('Datagrid imperative API', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function grid(): Datagrid<Row> {
    return fixture.debugElement.children[0].componentInstance as Datagrid<Row>;
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Data columns only: the selection column is the grid's own and unnamed. */
  function headerCaptions(): string[] {
    return [
      ...element().querySelectorAll<HTMLElement>('[role="columnheader"]:not([data-kind])'),
    ].map((cell) => cell.textContent.trim());
  }

  function renderedKeys(): (string | null)[] {
    return [...element().querySelectorAll<HTMLElement>('[role="row"][data-key]')].map((row) =>
      row.getAttribute('data-key'),
    );
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

  beforeEach(async () => {
    viewportHeight = 400;
    viewportWidth = 900;
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
      ],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle();
  });

  describe('shape', () => {
    it('is one stable object, not a new one per read', () => {
      expect(grid().api()).toBe(grid().api());
    });

    it('throws for every method whose milestone has not shipped', () => {
      const api = grid().api();
      expect(() => api.getPendingChanges()).toThrow(/M6/);
      expect(() => {
        api.startEdit('a');
      }).toThrow(/M6/);
    });

    it('no longer throws for the method the toolbar milestone shipped', () => {
      // jsdom lays nothing out, so every cell measures zero and no width is
      // written. What this asserts is that the call is live and safe.
      expect(() => {
        grid().api().autoSizeColumns();
      }).not.toThrow();
    });

    it('no longer throws for the methods grouping and row detail shipped', () => {
      const api = grid().api();
      expect(() => {
        api.setGroup([]);
        api.expandAllGroups();
        api.expandRow(1);
      }).not.toThrow();
      expect(api.getGroup()).toEqual([]);
      // No detail renderer is bound, so the row cannot actually expand.
      expect(api.getExpandedKeys()).toEqual([]);
    });
  });

  describe('data', () => {
    it('reads the loaded rows and one row by key', () => {
      expect(grid().api().getRows()).toHaveLength(20);
      expect(grid().api().getRow(3)?.name).toBe('Row 3');
      expect(grid().api().getRow(999)).toBeUndefined();
    });

    it('reports the total count', () => {
      expect(grid().api().getTotalCount()).toBe(20);
    });

    it('merges query facets and re-renders once', async () => {
      grid()
        .api()
        .applyQuery({ sort: [{ field: 'score', desc: true }] });
      await settle();
      expect(renderedKeys()[0]).toBe('20');
    });
  });

  describe('columns', () => {
    it('hides a column and writes the two-way binding', async () => {
      grid().api().setColumnVisible('city', false);
      await settle();
      expect(headerCaptions()).not.toContain('City');
      expect(host.hiddenColumns()).toEqual(['city']);
    });

    it('shows a hidden column again', async () => {
      host.hiddenColumns.set(['city']);
      await settle();
      grid().api().setColumnVisible('city', true);
      await settle();
      expect(headerCaptions()).toContain('City');
    });

    it('moves a column', async () => {
      grid().api().moveColumn('score', 0);
      await settle();
      expect(headerCaptions().slice(0, 2)).toEqual(['Score', 'Name']);
    });

    it('sets a width the layout honours', async () => {
      grid().api().setColumnWidth('name', 320);
      await settle();
      expect(grid().api().getVisibleColumns()[0].width).toBe(320);
    });

    // The API is not a way round a column's own refusal: `allow` holds for the
    // code that drives the grid as well as for the user driving it.
    it('refuses a mutation the column forbids', async () => {
      host.columns.set([
        { ...COLUMNS[0], allow: { resizing: false, reordering: false, hiding: false } },
        COLUMNS[1],
        COLUMNS[2],
      ]);
      await settle();

      grid().api().setColumnWidth('name', 320);
      grid().api().moveColumn('name', 2);
      grid().api().setColumnVisible('name', false);
      await settle();

      expect(grid().api().getVisibleColumns()[0].width).toBe(200);
      expect(headerCaptions()).toEqual(['Name', 'City', 'Score']);
      expect(host.hiddenColumns()).toEqual([]);
    });

    it('refuses to move, resize or unpin one of the grid’s own columns', async () => {
      const selection = 'lib-datagrid:selection';
      grid().api().moveColumn(selection, 2);
      grid().api().setColumnWidth(selection, 200);
      grid().api().pinColumn(selection, false);
      await settle();

      const header = element().querySelector<HTMLElement>(`[role="columnheader"][data-kind]`);
      expect(header?.getAttribute('data-column')).toBe(selection);
      expect(header?.getAttribute('data-pinned')).toBe('start');
    });

    it('shows a column the definitions hid', async () => {
      host.columns.set([COLUMNS[0], { ...COLUMNS[1], visible: false }, COLUMNS[2]]);
      await settle();
      expect(headerCaptions()).not.toContain('City');
      // The declared hide reached the model, which is what makes it undoable.
      expect(host.hiddenColumns()).toEqual(['city']);

      grid().api().setColumnVisible('city', true);
      await settle();
      expect(headerCaptions()).toContain('City');
    });
  });

  describe('reset', () => {
    it('keeps the constraints the inputs own', async () => {
      host.baseFilter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      host.pagingMode.set('pager');
      host.pageSize.set(5);
      host.requireTotalCount.set(false);
      await settle();

      grid().api().reset();
      await settle();

      const query = grid().api().getQuery();
      expect(query.filter).toEqual({ field: 'city', op: 'eq', value: 'Nicosia' });
      expect(query.take).toBe(5);
      expect(query.requireTotalCount).toBeUndefined();
    });
  });

  describe('state', () => {
    it('round-trips an arrangement', async () => {
      grid().api().moveColumn('score', 0);
      grid().api().setColumnWidth('name', 320);
      await settle();
      const snapshot = grid().api().getState();

      grid().api().resetState();
      await settle();
      expect(headerCaptions().slice(0, 2)).toEqual(['Name', 'City']);

      expect(grid().api().setState(snapshot).applied).toBe(true);
      await settle();
      expect(headerCaptions().slice(0, 2)).toEqual(['Score', 'Name']);
    });

    it('re-syncs the sort model when a state carries one', async () => {
      const state: GridState = {
        version: GRID_STATE_VERSION,
        columns: [{ id: 'score', sort: { order: 'desc' } }],
      };
      grid().api().setState(state);
      await settle();
      expect(grid().api().getSort()).toEqual([{ field: 'score', desc: true }]);
      expect(renderedKeys()[0]).toBe('20');
    });

    it('re-syncs hidden columns when a state carries them', async () => {
      const state: GridState = {
        version: GRID_STATE_VERSION,
        columns: [{ id: 'city', visible: false }],
      };
      grid().api().setState(state);
      await settle();
      expect(host.hiddenColumns()).toEqual(['city']);
      expect(headerCaptions()).not.toContain('City');
    });

    // The pager reads the component model and the query reads the store, so a
    // restored size that reaches only one of them pages by two numbers.
    it('restores a page size into both the query and the pager', async () => {
      host.pagingMode.set('pager');
      host.pageSize.set(5);
      await settle();

      const state: GridState = { version: GRID_STATE_VERSION, columns: [], pageSize: 8 };
      grid().api().setState(state);
      await settle();

      expect(grid().api().getQuery().take).toBe(8);
      expect(host.pageSize()).toBe(8);
    });

    it('reports a state from an unmigratable version as not applied', () => {
      const report = grid()
        .api()
        .setState({ version: GRID_STATE_VERSION + 99, columns: [] });
      expect(report.applied).toBe(false);
    });

    it('compares against a reference state', async () => {
      const reference = grid().api().getState();
      expect(grid().api().isDirty(reference)).toBe(false);
      grid().api().setColumnWidth('name', 321);
      await settle();
      expect(grid().api().isDirty(reference)).toBe(true);
    });
  });

  describe('selection', () => {
    it('sets and reads the selection', async () => {
      grid().api().setSelectedKeys([2, 4]);
      await settle();
      expect(grid().api().getSelectedKeys()).toEqual([2, 4]);
      expect(
        grid()
          .api()
          .getSelectedRows()
          .map((row) => row.id),
      ).toEqual([2, 4]);
      expect(grid().api().getSelection()).toEqual({ kind: 'keys', keys: [2, 4] });
    });

    it('clears the selection', async () => {
      grid().api().setSelectedKeys([2]);
      await settle();
      grid().api().clearSelection();
      await settle();
      expect(grid().api().getSelectedKeys()).toEqual([]);
    });

    it('selects everything matching as a predicate, not a key list', async () => {
      grid().api().selectAllMatching();
      await settle();
      expect(grid().api().getSelection().kind).toBe('allMatching');
    });
  });

  describe('view', () => {
    it('scrolls a row into the window', async () => {
      grid().api().scrollToRow(18);
      await settle();
      expect(renderedKeys()).toContain('18');
    });

    it('reads back the scroll position it set', async () => {
      grid().api().setScrollPosition({ top: 120, left: 0 });
      await settle();
      expect(grid().api().getScrollPosition()).toEqual({ top: 120, left: 0 });
    });
  });

  describe('after destruction', () => {
    it('ignores a mutating call and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const api = grid().api();
      fixture.destroy();

      expect(() => {
        api.setSelectedKeys([1]);
      }).not.toThrow();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('setSelectedKeys'));
      warn.mockRestore();
    });

    it('answers a setState call with an unapplied report', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const api = grid().api();
      fixture.destroy();
      expect(api.setState({ version: GRID_STATE_VERSION, columns: [] })).toEqual({
        applied: false,
        droppedColumnIds: [],
      });
    });
  });

  describe('neutral shell', () => {
    it('renders with nothing bound at all', async () => {
      const bare = TestBed.createComponent(BareHost);
      bare.detectChanges();
      await bare.whenStable();
      const root = bare.nativeElement as HTMLElement;

      expect(root.querySelector('.dg-viewport')).not.toBeNull();
      expect(root.querySelectorAll('[role="columnheader"]')).toHaveLength(0);
      expect(root.querySelector('.dg-state')).toBeNull();
    });

    it('renders no rows, no columns and no empty message before columns arrive', async () => {
      host.columns.set([]);
      await settle();

      expect(headerCaptions()).toEqual([]);
      expect(renderedKeys()).toEqual([]);
      expect(element().querySelector('.dg-state')).toBeNull();
    });

    it('renders no rows while the key is missing', async () => {
      host.key.set(null);
      await settle();
      expect(renderedKeys()).toEqual([]);
      expect(element().querySelector('.dg-state')).toBeNull();
    });

    // The event contract promises the configuration has been applied, and a
    // fast source settles before columns bound asynchronously arrive.
    it('holds firstSettled until the configuration has arrived', async () => {
      host.columns.set([]);
      host.key.set(null);
      host.data.set(makeRows(5));
      host.events.set([]);
      await settle();
      expect(host.events()).not.toContain('firstSettled');

      host.columns.set(COLUMNS);
      host.key.set('id');
      await settle();
      expect(host.events().filter((name) => name === 'firstSettled')).toHaveLength(1);
    });

    it('fills in when the configuration arrives, without a remount', async () => {
      const before = element().querySelector('.dg-viewport');
      host.columns.set([]);
      host.key.set(null);
      host.data.set(null);
      await settle();

      host.columns.set(COLUMNS);
      host.key.set('id');
      host.data.set(makeRows(5));
      await settle();

      expect(element().querySelector('.dg-viewport')).toBe(before);
      expect(headerCaptions()).toEqual(['Name', 'City', 'Score']);
      expect(renderedKeys()).toEqual(['1', '2', '3', '4', '5']);
    });

    it('still shows the empty state once a configured grid has no data', async () => {
      host.data.set([]);
      await settle();
      expect(element().querySelector('[data-state="empty"]')).not.toBeNull();
    });
  });
});
