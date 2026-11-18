import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { Datagrid } from './datagrid';
import { filterBuilder, filterPanel, filterRow, headerFilters } from './features';
import type { DatagridFeature } from './features.types';
import { dayEnd, dayStart } from './core/filter/date-filter';
import type { ColumnDef } from './core/types/column.types';
import type { FilterNode } from './core/types/filter.types';
import type { DataInput, DistinctValuesRequest, GridDataSource } from './core/types/query.types';
import type { GridState } from './core/types/state.types';
import type { DataSource } from '@ui/data-source';

interface Row {
  id: number;
  name: string;
  city: string;
  price: number;
  active: boolean;
  starts: Date;
}

// jsdom performs no layout, so the viewport reports its size from here.
const VIEWPORT_HEIGHT = 600;
const VIEWPORT_WIDTH = 900;

const CITIES = ['Nicosia', 'Limassol', 'Larnaca'];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index + 1,
    name: index === 3 ? '' : `Row ${(index + 1).toString()}`,
    city: CITIES[index % CITIES.length],
    price: (index + 1) * 10,
    active: index % 2 === 0,
    starts: new Date(2026, 0, 5 + (index % 3), 12, 0),
  }));
}

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', width: 200 },
  { id: 'city', field: 'city', caption: 'City', width: 150 },
  { id: 'price', field: 'price', caption: 'Price', width: 120, dataType: 'number' },
  { id: 'active', field: 'active', caption: 'Active', width: 120, dataType: 'boolean' },
  { id: 'starts', field: 'starts', caption: 'Starts', width: 160, dataType: 'datetime' },
];

@Component({
  selector: 'lib-datagrid-filtering-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      key="id"
      [rowHeight]="40"
      [overscan]="0"
      [features]="features()"
      [filterSync]="filterSync()"
      [baseFilter]="baseFilter()"
      [(filter)]="filter"
      [(search)]="search"
    />
  `,
})
class Host {
  readonly columns = signal<ColumnDef<Row>[]>(COLUMNS);
  readonly data = signal<DataInput<Row>>(makeRows(9));
  readonly features = signal<readonly DatagridFeature[]>([]);
  readonly filter = signal<FilterNode | null>(null);
  readonly search = signal<string | null>(null);
  readonly baseFilter = signal<FilterNode | null>(null);
  readonly filterSync = signal(true);
}

describe('Datagrid filtering surfaces', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function grid(): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('lib-datagrid');
    if (found == null) {
      throw new Error('grid not rendered');
    }
    return found;
  }

  function gridComponent(): Datagrid<Row> {
    return fixture.debugElement.children[0].componentInstance as Datagrid<Row>;
  }

  function viewport(): HTMLElement {
    const found = grid().querySelector<HTMLElement>('.dg-viewport');
    if (found == null) {
      throw new Error('viewport not rendered');
    }
    return found;
  }

  function filterRowElement(): HTMLElement | null {
    return grid().querySelector<HTMLElement>('lib-datagrid-filter-row');
  }

  function filterCell(columnId: string): HTMLElement {
    const found = filterRowElement()?.querySelector<HTMLElement>(
      `[data-filter-cell][data-column="${columnId}"]`,
    );
    if (found == null) {
      throw new Error(`filter cell ${columnId} not rendered`);
    }
    return found;
  }

  function textEditor(columnId: string): HTMLInputElement {
    // `type="text"`, not `search`: the browser's own clear button is unstyled,
    // unlabelled and blue in WebKit, so the row uses `libIconField`'s instead.
    const found = filterCell(columnId).querySelector<HTMLInputElement>(
      '.dg-filter-editor input[type="text"]',
    );
    if (found == null) {
      throw new Error(`text editor ${columnId} not rendered`);
    }
    return found;
  }

  function numberEditor(columnId: string): HTMLInputElement {
    const found = filterCell(columnId).querySelector<HTMLInputElement>('.dg-filter-editor input');
    if (found == null) {
      throw new Error(`number editor ${columnId} not rendered`);
    }
    return found;
  }

  function operatorButton(columnId: string): HTMLElement {
    const found = filterCell(columnId).querySelector<HTMLElement>('.dg-filter-op');
    if (found == null) {
      throw new Error(`operator button ${columnId} not rendered`);
    }
    return found;
  }

  function headerCell(columnId: string): HTMLElement {
    const found = viewport().querySelector<HTMLElement>(
      `[role="columnheader"][data-column="${columnId}"]`,
    );
    if (found == null) {
      throw new Error(`header ${columnId} not rendered`);
    }
    return found;
  }

  function bodyRowKeys(): string[] {
    return [
      ...viewport().querySelectorAll<HTMLElement>('lib-datagrid-body [role="row"][data-key]'),
    ].map((row) => row.getAttribute('data-key') ?? '');
  }

  function chips(): HTMLElement[] {
    return [...grid().querySelectorAll<HTMLElement>('lib-datagrid-filter-panel .dg-fp-chip')];
  }

  /** One string per chip. Read span by span: the spans carry no whitespace. */
  function chipText(): string[] {
    return chips().map((chip) =>
      [...chip.querySelectorAll('span')].map((part) => part.textContent.trim()).join(' '),
    );
  }

  /** The header filter overlay, which portals to the document body. */
  function headerFilterPanel(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('lib-datagrid-header-filter');
  }

  function panelEntries(): HTMLElement[] {
    return [...(headerFilterPanel()?.querySelectorAll<HTMLElement>('.dg-hf-list li') ?? [])];
  }

  function panelButton(text: string): HTMLElement {
    const found = [...(headerFilterPanel()?.querySelectorAll<HTMLElement>('button') ?? [])].find(
      (button) => button.textContent.trim() === text,
    );
    if (found === undefined) {
      throw new Error(`panel button "${text}" not rendered`);
    }
    return found;
  }

  async function type(columnId: string, value: string): Promise<void> {
    const input = textEditor(columnId);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function commit(columnId: string): Promise<void> {
    textEditor(columnId).dispatchEvent(new Event('blur', { bubbles: false }));
    await settle();
  }

  function activeQueryFilter(): FilterNode | null {
    return gridComponent().api().getQuery().filter ?? null;
  }

  beforeEach(async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => VIEWPORT_HEIGHT,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => VIEWPORT_WIDTH,
    });
    TestBed.configureTestingModule({
      imports: [Host],
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

  afterEach(() => {
    for (const pane of document.body.querySelectorAll('.cdk-overlay-container')) {
      pane.remove();
    }
  });

  describe('the missing-field warning', () => {
    /** A server that returns only the members a load selects, as an OData `$select` does. */
    const projecting: GridDataSource<Row> = {
      load: (query) => {
        const select = query.select;
        const rows = makeRows(3).map((row) =>
          select == null
            ? row
            : (Object.fromEntries(
                Object.entries(row).filter(([name]) => name === 'id' || select.includes(name)),
              ) as unknown as Row),
        );
        return Promise.resolve({ rows, totalCount: rows.length });
      },
    };

    /** Collects every warning, so the assertions read text rather than a spy's calls. */
    function captureWarnings(): { texts: string[]; restore: () => void } {
      const texts: string[] = [];
      const spy = vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
        texts.push(String(message));
      });
      return {
        texts,
        restore: () => {
          spy.mockRestore();
        },
      };
    }

    it('is silent about a hidden column, whose field a projected load leaves out', async () => {
      const captured = captureWarnings();
      try {
        host.columns.set(
          COLUMNS.map((column) => (column.id === 'price' ? { ...column, visible: false } : column)),
        );
        host.data.set(projecting);
        await settle();
        gridComponent().api().setColumnVisible('price', true);
        await settle();
        expect(
          captured.texts.filter((text) => text.includes('absent from the loaded rows')),
        ).toEqual([]);
      } finally {
        captured.restore();
      }
    });

    it('still reports a visible column whose field no row has', async () => {
      const captured = captureWarnings();
      try {
        host.columns.set([...COLUMNS, { id: 'typo', field: 'nmae', caption: 'Typo' }]);
        await settle();
        expect(captured.texts.some((text) => text.includes('"typo" reads field "nmae"'))).toBe(
          true,
        );
      } finally {
        captured.restore();
      }
    });
  });

  describe('feature registration', () => {
    it('renders no optional surface until a feature asks for one', () => {
      expect(filterRowElement()).toBeNull();
      expect(grid().querySelector('lib-datagrid-filter-panel')).toBeNull();
      expect(headerCell('name').querySelector('[data-header-filter]')).toBeNull();
    });

    it('renders the filter row once the descriptor is passed as a value', async () => {
      host.features.set([filterRow()]);
      await settle();
      expect(filterRowElement()).not.toBeNull();
      expect(filterCell('name')).toBeTruthy();
    });

    it('offers the header filter affordance only under its own feature', async () => {
      host.features.set([filterRow()]);
      await settle();
      expect(headerCell('name').querySelector('[data-header-filter]')).toBeNull();
      host.features.set([filterRow(), headerFilters()]);
      await settle();
      expect(headerCell('name').querySelector('[data-header-filter]')).not.toBeNull();
    });
  });

  describe('filter row', () => {
    beforeEach(async () => {
      host.features.set([filterRow({ apply: 'deferred' })]);
      await settle();
    });

    it('is its own rowgroup, indexed after the header', () => {
      const row = filterRowElement();
      expect(row?.getAttribute('role')).toBe('rowgroup');
      expect(row?.querySelector('[role="row"]')?.getAttribute('aria-rowindex')).toBe('2');
    });

    // The filter row is a row of the grid, so the body indexes after it and the
    // reported count includes it.
    it('shifts the body row indices and the row count', async () => {
      const firstRow = viewport().querySelector<HTMLElement>(
        'lib-datagrid-body [role="row"][data-key]',
      );
      expect(firstRow?.getAttribute('aria-rowindex')).toBe('3');
      expect(viewport().getAttribute('aria-rowcount')).toBe('11');
      host.features.set([]);
      await settle();
      expect(viewport().getAttribute('aria-rowcount')).toBe('10');
      expect(
        viewport()
          .querySelector('lib-datagrid-body [role="row"][data-key]')
          ?.getAttribute('aria-rowindex'),
      ).toBe('2');
    });

    it('draws no editor for a column that refuses filtering', async () => {
      host.columns.set(
        COLUMNS.map((column) =>
          column.id === 'city' ? { ...column, allow: { filtering: false } } : column,
        ),
      );
      await settle();
      expect(filterCell('city').querySelector('.dg-filter-op')).toBeNull();
      expect(filterCell('name').querySelector('.dg-filter-op')).not.toBeNull();
    });

    it('gives each editor a name that carries its column', () => {
      expect(textEditor('name').getAttribute('aria-label')).toBe('Filter by Name');
      expect(operatorButton('name').getAttribute('aria-label')).toContain('Name');
      expect(operatorButton('name').getAttribute('aria-label')).toContain('Contains');
    });

    // `libIconField` provides its own Transloco scope, and a pipe written on
    // content projected into it resolves against that scope instead of the
    // grid's — the name came back as an empty string.
    it('names the text editor through the grid scope, not the wrapper’s', () => {
      expect(textEditor('name').getAttribute('aria-label')).toBe('Filter by Name');
    });

    it('clears a text editor with the library button, not the browser’s', async () => {
      await type('name', 'Row 2');
      await commit('name');
      expect(activeQueryFilter()).not.toBeNull();

      // `type="search"` would render the browser's own unstyled clear instead.
      expect(textEditor('name').getAttribute('type')).toBe('text');
      const clear = filterCell('name').querySelector<HTMLElement>('.input-clear-button');
      if (clear == null) {
        throw new Error('clear button not rendered');
      }
      clear.click();
      await settle();
      await commit('name');

      expect(textEditor('name').value).toBe('');
      expect(activeQueryFilter()).toBeNull();
    });

    it('shows the active operation on the chooser, and checks it in the menu', async () => {
      const icon = operatorButton('name').querySelector('svg');
      expect(icon).not.toBeNull();

      operatorButton('name').click();
      await settle();
      const options = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
      const checked = options.filter((item) => item.getAttribute('aria-checked') === 'true');
      expect(checked.length).toBe(1);
      expect(checked[0].textContent.trim()).toBe('Contains');
      // Checked, not disabled: a disabled entry reads as "unavailable" and
      // drops out of the keyboard walk.
      expect(checked[0].getAttribute('aria-disabled')).not.toBe('true');
      // Every entry keeps its own glyph, so the list stays readable at a glance.
      expect(options.every((item) => item.querySelector('svg') != null)).toBe(true);
    });

    it('resets a column from the operator menu', async () => {
      await type('name', 'Row 2');
      await commit('name');
      expect(activeQueryFilter()).not.toBeNull();

      operatorButton('name').click();
      await settle();
      const reset = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
        /reset this column/i.test(item.textContent),
      );
      if (reset == null) {
        throw new Error('reset entry not rendered');
      }
      reset.click();
      await settle();

      expect(activeQueryFilter()).toBeNull();
    });

    it('draws one field for a range, not two editors in the column track', async () => {
      gridComponent()
        .api()
        .setColumnFilter('price', {
          field: 'price',
          op: 'between',
          value: [10, 50],
        });
      await settle();

      const cell = filterCell('price');
      expect(cell.querySelectorAll('lib-input-number')).toHaveLength(0);
      const trigger = cell.querySelector<HTMLElement>('.dg-filter-range');
      expect(trigger?.textContent.trim()).toBe('10 – 50');
    });

    it('picks an editor from the column data type', async () => {
      expect(filterCell('price').querySelector('lib-input-number')).not.toBeNull();
      expect(filterCell('active').querySelector('lib-select')).not.toBeNull();
      const datetime = filterCell('starts').querySelector('lib-datetime-picker');
      expect(datetime).not.toBeNull();
      expect(datetime?.getAttribute('data-icon-position')).toBe('end');
      expect(datetime?.hasAttribute('data-frameless')).toBe(true);
      expect(datetime?.querySelector('input')?.hasAttribute('placeholder')).toBe(false);
      await Promise.resolve();
    });

    it('filters the rows once the editor commits', async () => {
      await type('name', 'Row 2');
      expect(bodyRowKeys()).toHaveLength(9);
      await commit('name');
      expect(bodyRowKeys()).toEqual(['2']);
      expect(activeQueryFilter()).toEqual({ field: 'name', op: 'contains', value: 'Row 2' });
    });

    it('widens a datetime selection to the whole day while time is off', async () => {
      const input = filterCell('starts').querySelector<HTMLInputElement>('.datetime-input');
      if (input == null) throw new Error('datetime input not rendered');
      input.value = '1/5/2026';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await settle();
      expect(bodyRowKeys()).toEqual(['1', '4', '7']);
      expect(activeQueryFilter()).toEqual({
        field: 'starts',
        op: 'between',
        value: [dayStart('2026-01-05'), dayEnd('2026-01-05')],
      });
    });

    it('drops the condition again when the editor is emptied', async () => {
      await type('name', 'Row 2');
      await commit('name');
      await type('name', '');
      await commit('name');
      expect(activeQueryFilter()).toBeNull();
      expect(bodyRowKeys()).toHaveLength(9);
    });

    // The editor state is the row's own facet: re-deriving it from the stored
    // node would flip the chooser to "between" the moment a day was picked.
    it('keeps the operator the user chose when the node it built differs', async () => {
      gridComponent()
        .api()
        .setColumnFilter('starts', {
          field: 'starts',
          op: 'between',
          value: [dayStart('2026-01-05'), dayEnd('2026-01-05')],
        });
      await settle();
      expect(operatorButton('starts').getAttribute('aria-label')).toContain('Between');
    });

    it('reports a filter it cannot show rather than looking empty', async () => {
      gridComponent()
        .api()
        .setColumnFilter('name', { op: 'not', node: { field: 'name', op: 'eq', value: 'x' } });
      await settle();
      expect(filterCell('name').querySelector('.dg-filter-note')?.textContent.trim()).toBe(
        'Set outside the filter row',
      );
    });

    it('mirrors a representable condition the free tree holds', async () => {
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      expect(filterCell('city').querySelector('.dg-filter-note')).toBeNull();
      expect(textEditor('city').value).toBe('Nicosia');
      expect(operatorButton('city').getAttribute('aria-label')).toContain('Equals');
    });

    it('takes the field off the free tree when the user edits the mirrored cell', async () => {
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();

      await type('city', 'Limassol');
      await commit('city');

      // Both surfaces holding the field would filter it twice, once by what
      // the user typed and once by what they replaced.
      expect(host.filter()).toBeNull();
      expect(gridComponent().api().getColumnFilter('city')).toEqual({
        field: 'city',
        op: 'eq',
        value: 'Limassol',
      });
    });

    it('reports a tree expression no single cell can hold', async () => {
      host.filter.set({
        op: 'and',
        nodes: [
          { field: 'city', op: 'ne', value: 'Nicosia' },
          { field: 'city', op: 'ne', value: 'Larnaca' },
        ],
      });
      await settle();
      expect(filterCell('city').querySelector('.dg-filter-note')).not.toBeNull();
    });

    it('says nothing about the free tree when synchronization is off', async () => {
      host.filterSync.set(false);
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      expect(filterCell('city').querySelector('.dg-filter-note')).toBeNull();
    });
  });

  describe('deferred and automatic apply', () => {
    it('waits for a commit in deferred mode', async () => {
      host.features.set([filterRow({ apply: 'deferred' })]);
      await settle();
      await type('name', 'Row 1');
      expect(activeQueryFilter()).toBeNull();
      await commit('name');
      expect(activeQueryFilter()).not.toBeNull();
    });

    // The data store coalesces per microtask, which is enough for a paste but
    // not for typing: a remote source would see a request per keystroke.
    // Real timers, not fake ones: the filter row arrives through a deferred
    // block, and `whenStable` has to resolve its import first.
    it('debounces typing in automatic mode', async () => {
      host.features.set([filterRow()]);
      await settle();
      await type('name', 'Row 1');
      expect(activeQueryFilter()).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 350));
      await settle();
      expect(activeQueryFilter()).toEqual({ field: 'name', op: 'contains', value: 'Row 1' });
    });

    // `@ui/input-number` commits on blur by design, so a number editor left to
    // its default emits nothing while the reader types and the debounce has
    // nothing to debounce — the filter would wait for the editor to be left.
    it('debounces a number editor as it is typed, without waiting for a blur', async () => {
      host.features.set([filterRow()]);
      await settle();
      const input = numberEditor('price');
      input.focus();
      input.value = '12';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      expect(activeQueryFilter()).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 350));
      await settle();

      expect(activeQueryFilter()).toEqual({ field: 'price', op: 'eq', value: 12 });
    });

    // Reconciling focus after a data change moves the focused *position*, and
    // the effect that applies DOM focus re-runs on that. Narrowing to a single
    // row is what makes the position move, so the row the filter found stole
    // focus out of the editor the reader was still typing in.
    it('leaves focus in the editor when the rows narrow to one', async () => {
      host.columns.set([{ ...COLUMNS[0], primary: true }, COLUMNS[1]]);
      host.features.set([filterRow()]);
      await settle();
      // Seed a focused cell, which is what arms the DOM-focus effect at all.
      gridComponent().api().focusCell(5, 'name');
      await settle();

      const input = textEditor('name');
      input.focus();
      expect(document.activeElement).toBe(input);

      await type('name', 'Row 1');
      await new Promise((resolve) => setTimeout(resolve, 350));
      await settle();

      expect(activeQueryFilter()).not.toBeNull();
      expect(document.activeElement).toBe(input);
    });

    it('keeps a datetime filter clear after selecting now', async () => {
      host.features.set([filterRow()]);
      await settle();
      const cell = filterCell('starts');
      const open = cell.querySelector<HTMLButtonElement>('.datetime-calendar-button');
      if (open == null) throw new Error('datetime calendar button not rendered');
      open.click();
      await settle();
      const now = document.body.querySelector<HTMLButtonElement>('.date-now-button');
      const apply = document.body.querySelector<HTMLButtonElement>(
        '.datetime-actions button:last-child',
      );
      if (now == null || apply == null) throw new Error('datetime panel actions not rendered');
      now.click();
      apply.click();
      await settle();
      expect(gridComponent().api().getColumnFilter('starts')).not.toBeNull();

      const clear = cell.querySelector<HTMLButtonElement>('.datetime-clear');
      if (clear == null) throw new Error('datetime clear button not rendered');
      clear.click();
      await settle();
      await new Promise((resolve) => setTimeout(resolve, 350));
      await settle();

      expect(gridComponent().api().getColumnFilter('starts')).toBeNull();
      expect(cell.querySelector<HTMLInputElement>('.datetime-input')?.value).toBe('');
    });
  });

  describe('relative date periods', () => {
    beforeEach(async () => {
      host.features.set([filterRow({ apply: 'deferred' })]);
      await settle();
    });

    // The descriptor stays a descriptor in the state and in `getQuery()`; it
    // becomes a range only where the source sees it, so every load re-evaluates
    // it against the current instant (§7.4).
    it('stores a descriptor and materializes it only for the source', async () => {
      const now = new Date();
      host.data.set([
        { ...makeRows(1)[0], id: 1, starts: now },
        { ...makeRows(1)[0], id: 2, starts: new Date(2000, 0, 1) },
      ]);
      await settle();
      gridComponent().api().setState(relativeState());
      await settle();
      expect(activeQueryFilter()).toBeNull();
      expect(
        gridComponent()
          .api()
          .getState()
          .columns.find((entry) => entry.id === 'starts'),
      ).toMatchObject({ relativeDateFilter: { direction: 'last', amount: 7, unit: 'day' } });
      expect(bodyRowKeys()).toEqual(['1']);
    });

    it('shows the period in the cell instead of an editor', async () => {
      gridComponent().api().setState(relativeState());
      await settle();
      expect(filterCell('starts').querySelector('.dg-filter-note')?.textContent).toContain('7');
      expect(filterCell('starts').querySelector('lib-date-picker')).toBeNull();
    });

    // §7.4: the most recent explicit action wins, and the two never oscillate.
    it('an explicit edit ends the period', async () => {
      gridComponent().api().setState(relativeState());
      await settle();
      gridComponent()
        .api()
        .setColumnFilter('starts', {
          field: 'starts',
          op: 'ge',
          value: dayStart('2026-01-06'),
        });
      await settle();
      expect(
        gridComponent()
          .api()
          .getState()
          .columns.find((c) => c.id === 'starts')?.relativeDateFilter,
      ).toBeUndefined();
    });

    describe("a column's initial filter", () => {
      const future = new Date(Date.now() + 86_400_000);
      const initialColumns: ColumnDef<Row>[] = COLUMNS.map((column) =>
        column.id === 'starts'
          ? {
              ...column,
              filter: { initial: { relative: { direction: 'from', amount: 0, unit: 'day' } } },
            }
          : column,
      );

      beforeEach(async () => {
        // A fresh grid: the seed runs once, on the first columns the grid sees.
        fixture = TestBed.createComponent(Host);
        host = fixture.componentInstance;
        host.columns.set(initialColumns);
        host.features.set([filterRow()]);
        host.data.set([
          { ...makeRows(1)[0], id: 1, starts: future },
          { ...makeRows(1)[0], id: 2, starts: new Date(2000, 0, 1) },
        ]);
        await settle();
      });

      it('narrows the first load and shows in the filter row', () => {
        expect(bodyRowKeys()).toEqual(['1']);
        expect(filterCell('starts').querySelector('.dg-filter-note')?.textContent).toContain(
          'Today onward',
        );
      });

      it('comes back on reset after the reader cleared it', async () => {
        gridComponent().api().clearFilters();
        await settle();
        expect(bodyRowKeys()).toEqual(['1', '2']);
        gridComponent().api().resetState();
        await settle();
        expect(bodyRowKeys()).toEqual(['1']);
      });
    });

    function relativeState(): GridState {
      const state = gridComponent().api().getState();
      return {
        ...state,
        columns: state.columns.map((column) =>
          column.id === 'starts'
            ? { ...column, relativeDateFilter: { direction: 'last', amount: 7, unit: 'day' } }
            : column,
        ),
      };
    }
  });

  describe('header filter', () => {
    beforeEach(async () => {
      host.features.set([headerFilters({ pageSize: 2 })]);
      await settle();
    });

    async function open(columnId: string): Promise<void> {
      headerCell(columnId)
        .querySelector<HTMLElement>('[data-header-filter]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
    }

    describe('from a source of its own', () => {
      interface Town {
        name: string;
        alias: string;
      }
      const TOWNS: Town[] = [
        { name: 'Larnaca', alias: 'larnaka' },
        { name: 'Limassol', alias: 'lemesos' },
        { name: 'Nicosia', alias: 'lefkosia' },
      ];
      const searches: (string | null | undefined)[] = [];
      const townSource: DataSource<Town> = {
        load: (request) => {
          searches.push(request.search);
          const needle = request.search?.toLowerCase() ?? '';
          const matching = TOWNS.filter((town) => needle === '' || town.alias.includes(needle));
          const skip = request.skip ?? 0;
          return Promise.resolve({
            rows: matching.slice(skip, skip + (request.take ?? matching.length)),
            totalCount: matching.length,
          });
        },
        byKeys: (keys) => Promise.resolve(TOWNS.filter((town) => keys.includes(town.name))),
      };

      beforeEach(async () => {
        searches.length = 0;
        host.columns.set(
          COLUMNS.map((column) =>
            column.id === 'city'
              ? {
                  ...column,
                  filter: {
                    headerFilterSource: {
                      source: townSource,
                      value: (town: Town) => town.name,
                      label: (town: Town) => town.name.toUpperCase(),
                    },
                  },
                }
              : column,
          ),
        );
        await settle();
      });

      it('lists the source, with no "Select all"', async () => {
        await open('city');
        expect(panelEntries().map((entry) => entry.textContent.trim())).toEqual([
          'LARNACA',
          'LIMASSOL',
        ]);
        expect(headerFilterPanel()?.textContent).not.toContain('Select all');
      });

      it('filters the grid by the checked values', async () => {
        await open('city');
        checkEntry(1);
        await settle();
        panelButton('Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await settle();
        expect(activeQueryFilter()).toEqual({ field: 'city', op: 'eq', value: 'Limassol' });
      });

      it('lists a restored value that is not on the first page, checked', async () => {
        gridComponent()
          .api()
          .setHeaderFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
        await settle();
        await open('city');
        // The page and then the restored value: two round trips.
        await settle();
        const checked = panelEntries().filter(
          (entry) => entry.querySelector('input')?.checked === true,
        );
        expect(checked.map((entry) => entry.textContent.trim())).toEqual(['NICOSIA']);
      });

      it('leaves the matching to the source, which reads what the label does not show', async () => {
        vi.useFakeTimers();
        try {
          await open('city');
          const search =
            headerFilterPanel()?.querySelector<HTMLInputElement>('input[type="search"]');
          if (search == null) {
            throw new Error('search not rendered');
          }
          search.value = 'lefkosia';
          search.dispatchEvent(new Event('input', { bubbles: true }));
          await vi.advanceTimersByTimeAsync(300);
        } finally {
          vi.useRealTimers();
        }
        await settle();
        expect(searches.at(-1)).toBe('lefkosia');
        expect(panelEntries().map((entry) => entry.textContent.trim())).toEqual(['NICOSIA']);
      });

      it('pages the source behind "show more", without repeating an entry', async () => {
        await open('city');
        panelButton('Show more values').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await settle();
        expect(panelEntries().map((entry) => entry.textContent.trim())).toEqual([
          'LARNACA',
          'LIMASSOL',
          'NICOSIA',
        ]);
      });
    });

    it('opens a dialog listing the distinct values of the loaded rows', async () => {
      await open('city');
      const panel = headerFilterPanel();
      expect(panel?.getAttribute('role')).toBe('dialog');
      expect(panel?.getAttribute('aria-label')).toContain('City');
      expect(panelEntries()).toHaveLength(2);
    });

    it('loads a remote column domain without any grid filter and caches it', async () => {
      const requests: DistinctValuesRequest[] = [];
      const source: GridDataSource<Row> = {
        load: () => Promise.resolve({ rows: makeRows(2), totalCount: 9 }),
        loadDistinct: (request) => {
          requests.push(request);
          return Promise.resolve({
            values: CITIES.map((value) => ({ value, count: 3 })),
          });
        },
      };
      host.data.set(source);
      await settle();
      gridComponent().api().setColumnFilter('price', { field: 'price', op: 'gt', value: 50 });
      gridComponent().api().setHeaderFilter('city', {
        field: 'city',
        op: 'eq',
        value: 'Nicosia',
      });
      await settle();

      await open('city');
      expect(requests).toHaveLength(1);
      expect(requests[0].filter).toBeNull();

      panelButton('Cancel').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      await open('city');
      expect(requests).toHaveLength(1);
    });

    it('reports when a remote source can expose only loaded rows', async () => {
      host.data.set({
        load: () => Promise.resolve({ rows: makeRows(2), totalCount: 9 }),
      });
      await settle();

      await open('city');

      expect(headerFilterPanel()?.textContent).toContain('only the rows loaded so far');
    });

    it('pages a long value list behind "show more"', async () => {
      await open('city');
      panelButton('Show more values').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(panelEntries()).toHaveLength(3);
    });

    it('applies the checked values as one `in` condition', async () => {
      await open('city');
      checkEntry(0);
      checkEntry(1);
      await settle();
      panelButton('Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(activeQueryFilter()).toEqual({
        field: 'city',
        op: 'in',
        value: ['Larnaca', 'Limassol'],
      });
    });

    it('checks what the column already filters on when it reopens', async () => {
      gridComponent().api().setHeaderFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      await open('city');
      panelButton('Show more values').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      const checked = panelEntries().filter(
        (entry) => entry.querySelector('input')?.checked === true,
      );
      expect(checked).toHaveLength(1);
    });

    it('clears the column when everything is unchecked', async () => {
      gridComponent().api().setHeaderFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      await open('city');
      // The domain is independent of the active filter, so reach the selected
      // value on the next page and clear only that value.
      panelButton('Show more values').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      const checked = panelEntries().find(
        (entry) => entry.querySelector('input')?.checked === true,
      );
      const input = checked?.querySelector<HTMLInputElement>('input');
      if (input == null) {
        throw new Error('checked city not rendered');
      }
      input.click();
      await settle();
      panelButton('Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(activeQueryFilter()).toBeNull();
    });

    // The two surfaces hold separate slots. Before the split they shared one,
    // so applying either destroyed the other without telling the user.
    it('keeps the filter row condition when a header filter is applied', async () => {
      const api = gridComponent().api();
      api.setColumnFilter('city', { field: 'city', op: 'contains', value: 'a' });
      await settle();
      await open('city');
      checkEntry(0);
      await settle();
      panelButton('Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(api.getColumnFilter('city')).toEqual({
        field: 'city',
        op: 'contains',
        value: 'a',
      });
      expect(api.getHeaderFilter('city')).not.toBeNull();
      expect(activeQueryFilter()).toMatchObject({ op: 'and' });
    });

    it('clears one slot without touching the other', async () => {
      const api = gridComponent().api();
      api.setColumnFilter('city', { field: 'city', op: 'contains', value: 'a' });
      api.setHeaderFilter('city', { field: 'city', op: 'eq', value: 'Larnaca' });
      await settle();

      api.clearHeaderFilter('city');
      await settle();
      expect(api.getHeaderFilter('city')).toBeNull();
      expect(api.getColumnFilter('city')).not.toBeNull();

      api.clearColumnFilter('city');
      await settle();
      expect(api.getColumnFilter('city')).toBeNull();
    });

    it('round-trips both slots through the state', async () => {
      const api = gridComponent().api();
      api.setColumnFilter('city', { field: 'city', op: 'contains', value: 'a' });
      api.setHeaderFilter('city', { field: 'city', op: 'eq', value: 'Larnaca' });
      await settle();
      const snapshot = api.getState();

      api.clearColumnFilter('city');
      await settle();
      expect(api.getColumnFilter('city')).toBeNull();
      expect(api.getHeaderFilter('city')).toBeNull();

      api.setState(snapshot);
      await settle();
      expect(api.getColumnFilter('city')).toEqual({
        field: 'city',
        op: 'contains',
        value: 'a',
      });
      expect(api.getHeaderFilter('city')).toEqual({
        field: 'city',
        op: 'eq',
        value: 'Larnaca',
      });
    });

    it('offers a blank entry for rows with no value', async () => {
      await open('name');
      const labels = panelEntries().map((entry) => entry.textContent.trim());
      expect(labels.some((label) => label.startsWith('(blanks)'))).toBe(true);
    });

    it('honours a host-supplied option list carrying its own node', async () => {
      host.columns.set(
        COLUMNS.map((column) =>
          column.id === 'price'
            ? {
                ...column,
                filter: {
                  headerFilterOptions: [
                    { label: 'Cheap', node: { field: 'price', op: 'le', value: 30 } },
                  ],
                },
              }
            : column,
        ),
      );
      await settle();
      await open('price');
      expect(panelEntries()).toHaveLength(1);
      checkEntry(0);
      await settle();
      panelButton('Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(activeQueryFilter()).toEqual({ field: 'price', op: 'le', value: 30 });
      expect(bodyRowKeys()).toEqual(['1', '2', '3']);
    });

    it('marks the header of a filtered column', async () => {
      expect(headerCell('city').hasAttribute('data-filtered')).toBe(false);
      gridComponent().api().setColumnFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      expect(headerCell('city').hasAttribute('data-filtered')).toBe(true);
    });

    // The entry is labelled by what the column displays and tests what the
    // source stores. Filtering on the label would compare "Active" against a
    // field holding a code.
    it('labels an entry by its display value and filters on the raw one', async () => {
      host.columns.set(
        COLUMNS.map((column) =>
          column.id === 'active'
            ? { ...column, display: (row: Row): string => (row.active ? 'Open' : 'Closed') }
            : column,
        ),
      );
      await settle();
      await open('active');

      expect(panelEntries().map((entry) => entry.textContent.trim())).toEqual([
        expect.stringContaining('Closed'),
        expect.stringContaining('Open'),
      ]);

      checkEntry(1);
      await settle();
      panelButton('Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(activeQueryFilter()).toEqual({ field: 'active', op: 'eq', value: true });
    });

    it('renders a date tree and reports a half-selected month as mixed', async () => {
      await open('starts');
      let items = [...document.body.querySelectorAll<HTMLElement>('[role="treeitem"]')];
      items[0].querySelector<HTMLElement>('.tree-chevron')?.click();
      await settle();
      items = [...document.body.querySelectorAll<HTMLElement>('[role="treeitem"]')];
      items[1].querySelector<HTMLElement>('.tree-chevron')?.click();
      await settle();
      items = [...document.body.querySelectorAll<HTMLElement>('[role="treeitem"]')];
      items[2].querySelector<HTMLElement>('.tree-label-hit')?.click();
      await settle();

      expect(items[0].getAttribute('aria-checked')).toBe('mixed');
      expect(items[1].getAttribute('aria-checked')).toBe('mixed');

      panelButton('Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(gridComponent().api().getHeaderFilter('starts')).toEqual({
        field: 'starts',
        op: 'between',
        value: [new Date(2026, 0, 5, 0, 0, 0, 0), new Date(2026, 0, 5, 23, 59, 59, 999)],
      });
    });

    it('states when a datetime source falls back to a generated calendar', async () => {
      const rows = makeRows(3);
      host.data.set({
        load: (query) => {
          if (query.sort?.[0]?.field === 'starts') {
            return Promise.resolve({ rows: [query.sort[0].desc ? rows[2] : rows[0]] });
          }
          return Promise.resolve({ rows });
        },
        loadDistinct: () =>
          Promise.resolve({ values: rows.map((row) => ({ value: row.starts, count: 1 })) }),
      });
      await settle();

      await open('starts');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await settle();

      expect(headerFilterPanel()?.textContent).toContain('full date range');
      expect(headerFilterPanel()?.querySelector('.dg-hf-tree')).not.toBeNull();
    });

    function checkEntry(index: number): void {
      const input = panelEntries()[index].querySelector<HTMLInputElement>('input');
      if (input == null) {
        throw new Error(`entry ${index.toString()} has no checkbox`);
      }
      input.click();
    }
  });

  describe('filter panel', () => {
    beforeEach(async () => {
      host.features.set([filterPanel()]);
      await settle();
    });

    it('stays out of the way until something filters', async () => {
      expect(grid().querySelector('lib-datagrid-filter-panel')).toBeNull();
      host.search.set('Row 1');
      await settle();
      expect(grid().querySelector('lib-datagrid-filter-panel')).not.toBeNull();
    });

    it('sits above the rows by default and below them on request', async () => {
      host.search.set('Row 1');
      await settle();

      function element(selector: string): Element {
        const found = grid().querySelector(selector);
        if (found == null) {
          throw new Error(`${selector} not rendered`);
        }
        return found;
      }
      const panel = (): Element => element('lib-datagrid-filter-panel');
      // `DOCUMENT_POSITION_FOLLOWING` from the viewport means "comes after it".
      const after = (): boolean =>
        (element('.dg-viewport').compareDocumentPosition(panel()) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
        0;

      expect(after()).toBe(false);
      expect(panel().getAttribute('data-position')).toBe('top');

      host.features.set([filterPanel({ position: 'bottom' })]);
      await settle();

      expect(after()).toBe(true);
      expect(panel().getAttribute('data-position')).toBe('bottom');
      // One panel, not one per edge.
      expect(grid().querySelectorAll('lib-datagrid-filter-panel')).toHaveLength(1);
    });

    it('summarizes each facet in words', async () => {
      gridComponent()
        .api()
        .setColumnFilter('name', { field: 'name', op: 'contains', value: 'Row' });
      host.search.set('shop');
      await settle();
      expect(chipText()).toEqual(['Name Contains Row', 'Search shop']);
    });

    it('removes one entry without touching the others', async () => {
      gridComponent()
        .api()
        .setColumnFilter('name', { field: 'name', op: 'contains', value: 'Row' });
      host.search.set('shop');
      await settle();
      chips()[0].querySelector<HTMLElement>('.dg-fp-remove')?.click();
      await settle();
      expect(chipText()).toEqual(['Search shop']);
    });

    it('clears every filter at once, writing back to the host bindings', async () => {
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      host.search.set('shop');
      await settle();
      const clearAll = [
        ...grid().querySelectorAll<HTMLElement>('lib-datagrid-filter-panel button'),
      ].find((button) => button.textContent.trim() === 'Clear all filters');
      clearAll?.click();
      await settle();
      expect(host.filter()).toBeNull();
      expect(host.search()).toBeNull();
      expect(activeQueryFilter()).toBeNull();
    });

    it('flags an expression the filter row cannot edit', async () => {
      host.filter.set({ op: 'not', node: { field: 'city', op: 'eq', value: 'Nicosia' } });
      await settle();
      expect(chips()[0].hasAttribute('data-unsupported')).toBe(true);
      expect(chips()[0].querySelector('.dg-fp-warning')).not.toBeNull();
    });
  });

  // The engine's fallback is the own keys of the first row, which searches
  // properties no column shows and misses every nested and computed one.
  describe('global search', () => {
    it('searches a computed column by what it reads', async () => {
      host.columns.set([
        ...COLUMNS,
        { id: 'label', caption: 'Label', value: (row: Row): string => `${row.city}-${row.name}` },
      ]);
      await settle();
      host.search.set('Nicosia-Row 1');
      await settle();
      expect(bodyRowKeys()).toEqual(['1']);
    });

    it('stops searching a column once it is hidden', async () => {
      host.search.set('Larnaca');
      await settle();
      expect(bodyRowKeys().length).toBeGreaterThan(0);

      gridComponent().api().setColumnVisible('city', false);
      await settle();
      expect(bodyRowKeys()).toEqual([]);
    });
  });

  describe('base filter', () => {
    it('applies to every query and survives clear-all', async () => {
      host.baseFilter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      host.search.set('Row');
      await settle();
      // Row 4 is in Nicosia but carries no name, so the search excludes it.
      expect(bodyRowKeys()).toEqual(['1', '7']);
      gridComponent().api().clearFilters();
      await settle();
      expect(activeQueryFilter()).toEqual({ field: 'city', op: 'eq', value: 'Nicosia' });
      expect(bodyRowKeys()).toEqual(['1', '4', '7']);
    });

    // It is invisible to the user, so it must not appear among the filters the
    // panel offers to clear.
    it('never reaches the filter panel', async () => {
      host.features.set([filterPanel()]);
      host.baseFilter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      expect(grid().querySelector('lib-datagrid-filter-panel')).toBeNull();
    });
  });

  describe('the API and the state', () => {
    it('reads and writes one column at a time', async () => {
      const api = gridComponent().api();
      api.setColumnFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      expect(api.getColumnFilter('city')).toEqual({ field: 'city', op: 'eq', value: 'Nicosia' });
      api.clearColumnFilter('city');
      await settle();
      expect(api.getColumnFilter('city')).toBeNull();
    });

    it('combines the column filters and the free tree into one query', async () => {
      gridComponent().api().setColumnFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      host.filter.set({ field: 'price', op: 'gt', value: 20 });
      await settle();
      expect(activeQueryFilter()).toEqual({
        op: 'and',
        nodes: [
          { field: 'city', op: 'eq', value: 'Nicosia' },
          { field: 'price', op: 'gt', value: 20 },
        ],
      });
      expect(bodyRowKeys()).toEqual(['4', '7']);
    });

    it('round-trips a column filter and the search through the state', async () => {
      const api = gridComponent().api();
      api.setColumnFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      api.setSearch('Row');
      await settle();
      const saved = api.getState();
      api.clearFilters();
      await settle();
      expect(api.getColumnFilter('city')).toBeNull();
      api.setState(saved);
      await settle();
      expect(api.getColumnFilter('city')).toEqual({ field: 'city', op: 'eq', value: 'Nicosia' });
      expect(host.search()).toBe('Row');
      expect(api.isDirty(saved)).toBe(false);
    });

    // The store owns the value: a model left holding the old one makes the
    // host's next write an equal one, which schedules nothing.
    it('writes the cleared filter back to the host binding', async () => {
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      gridComponent().api().clearFilters();
      await settle();
      expect(host.filter()).toBeNull();
      host.filter.set({ field: 'city', op: 'eq', value: 'Limassol' });
      await settle();
      expect(activeQueryFilter()).toEqual({ field: 'city', op: 'eq', value: 'Limassol' });
    });

    it('reports the search through the API as well', async () => {
      gridComponent().api().setSearch('Row 2');
      await settle();
      expect(gridComponent().api().getSearch()).toBe('Row 2');
      expect(host.search()).toBe('Row 2');
    });
  });

  describe('filter builder', () => {
    /** The editor, which its overlay draws outside the grid host. */
    function builder(): HTMLElement | null {
      return document.body.querySelector<HTMLElement>('lib-datagrid-filter-builder');
    }

    function builderButton(name: string): HTMLElement {
      const found = builder()?.querySelector<HTMLElement>(`.dg-fb-${name}`);
      if (found == null) {
        throw new Error(`builder button ${name} not rendered`);
      }
      return found;
    }

    /**
     * The fields the editor offers, read from the chooser's menu. Every chooser
     * is a button over one overlay menu, so the list is only in the DOM while
     * it is open — which is the whole point: it takes no space in the panel.
     */
    async function builderFieldCaptions(): Promise<string[]> {
      builder()?.querySelector<HTMLElement>('.dg-fb-field')?.click();
      await settle();
      return [
        ...document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitem"]'),
      ].map((item) => item.textContent.trim());
    }

    function builderBar(): HTMLElement | null {
      return grid().querySelector<HTMLElement>('.dg-filter-builder-bar');
    }

    function panelBuilderTrigger(): HTMLElement | null {
      return grid().querySelector<HTMLElement>('lib-datagrid-filter-panel .dg-fp-actions button');
    }

    async function open(): Promise<void> {
      // The editor arrives by dynamic import, so awaiting the call matters.
      await gridComponent().openFilterBuilder(builderTrigger());
      await settle();
    }

    /** Whichever trigger is on screen: the panel's action or the bar's button. */
    function builderTrigger(): HTMLElement {
      const found =
        panelBuilderTrigger() ?? builderBar()?.querySelector<HTMLElement>('button') ?? null;
      if (found == null) {
        throw new Error('no filter builder trigger rendered');
      }
      return found;
    }

    it('offers no way in until the feature asks for one', async () => {
      host.features.set([filterRow(), filterPanel()]);
      await settle();
      expect(builderBar()).toBeNull();
      await gridComponent().openFilterBuilder(document.createElement('button'));
      await settle();
      expect(builder()).toBeNull();
    });

    it('draws its own bar while nothing filters the grid', async () => {
      host.features.set([filterBuilder()]);
      await settle();
      expect(builderBar()).not.toBeNull();
    });

    // The panel carries §7.2's edit affordance, and it is present exactly
    // when there is something to edit — so the two never both draw a trigger.
    it('hands the trigger to the filter panel once one appears', async () => {
      host.features.set([filterPanel(), filterBuilder()]);
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      expect(builderBar()).toBeNull();
      expect(panelBuilderTrigger()?.textContent.trim()).toBe('Edit filter');
    });

    // The editor is imported dynamically, so pressing the trigger resolves a
    // promise before anything renders.
    it('opens the editor from the bar, which downloads it on first use', async () => {
      host.features.set([filterBuilder()]);
      await settle();
      expect(builder()).toBeNull();
      builderBar()?.querySelector('button')?.click();
      // The trigger starts a dynamic import and does not await it, so the test waits for the
      // module to land. A busy machine can take seconds.
      await vi.waitFor(
        async () => {
          await settle();
          expect(builder()).not.toBeNull();
        },
        { timeout: 5000 },
      );
    });

    // The press on the trigger is outside the pane. It closed the editor in the capture phase,
    // and the trigger's own handler opened it again, so the editor flickered and stayed.
    it('closes from the trigger that opened it, and stays closed', async () => {
      host.features.set([filterBuilder()]);
      await settle();
      const press = async (): Promise<void> => {
        const trigger = builderTrigger();
        trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        trigger.click();
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          await settle();
        }
      };

      await press();
      expect(builder()).not.toBeNull();
      await press();
      expect(builder()).toBeNull();
      await press();
      expect(builder()).not.toBeNull();
    });

    it('opens on the free tree in force', async () => {
      host.features.set([filterBuilder()]);
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      await open();
      expect(builder()?.querySelectorAll('.dg-fb-condition')).toHaveLength(1);
    });

    it('writes the applied expression to the filter binding and the query', async () => {
      host.features.set([filterBuilder()]);
      await settle();
      await open();
      builderButton('add-condition').click();
      await settle();
      const input = builder()?.querySelector<HTMLInputElement>(
        '.dg-fb-condition input[type="text"]',
      );
      if (input == null) {
        throw new Error('condition editor not rendered');
      }
      input.value = 'Nicosia';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      builderButton('apply').click();
      await settle();
      expect(builder()).toBeNull();
      expect(host.filter()).toEqual({ field: 'name', op: 'contains', value: 'Nicosia' });
      expect(activeQueryFilter()).toEqual({ field: 'name', op: 'contains', value: 'Nicosia' });
    });

    it('leaves the filter alone on cancel', async () => {
      host.features.set([filterBuilder()]);
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      await open();
      builderButton('add-condition').click();
      await settle();
      builderButton('cancel').click();
      await settle();
      expect(builder()).toBeNull();
      expect(host.filter()).toEqual({ field: 'city', op: 'eq', value: 'Nicosia' });
    });

    it('offers one entry per filterable field, and none for a column that refuses', async () => {
      host.columns.set([
        ...COLUMNS.slice(0, 2).map((column) => ({ ...column })),
        { ...COLUMNS[2], allow: { filtering: false } },
      ]);
      host.features.set([filterBuilder()]);
      await settle();
      await open();
      builderButton('add-condition').click();
      await settle();
      expect(await builderFieldCaptions()).toEqual(['Name', 'City']);
    });

    // §7.3: a surface that is not the whole filter must say so.
    it('reports the per-column filters the expression does not hold', async () => {
      host.features.set([filterRow(), filterBuilder()]);
      await settle();
      await open();
      expect(builder()?.querySelectorAll('.dg-fb-note')).toHaveLength(0);
      builderButton('cancel').click();
      await settle();
      gridComponent().api().setColumnFilter('city', { field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      await open();
      expect(builder()?.querySelectorAll('.dg-fb-note')).toHaveLength(1);
    });

    // The row mirrors a top-level condition on its own field, so an expression
    // the builder wrote is editable there — §7.3 in the direction that works.
    it('shows a written condition in the filter row it belongs to', async () => {
      host.features.set([filterRow(), filterBuilder()]);
      host.filter.set({ field: 'city', op: 'eq', value: 'Nicosia' });
      await settle();
      expect(textEditor('city').value).toBe('Nicosia');
      expect(bodyRowKeys()).toEqual(['1', '4', '7']);
    });
  });
});
