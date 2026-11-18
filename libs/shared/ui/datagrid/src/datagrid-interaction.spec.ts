import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { ROW_NUMBER_COLUMN_ID, SELECTION_COLUMN_ID } from './core/builtin-columns';
import { Datagrid } from './datagrid';
import type { ResizeMode } from './core/column-resize.types';
import type { PagingMode } from './core/paging.types';
import type { SelectionMode } from './core/selection.store.types';
import type { SortCycle } from './core/sort-cycle.types';
import type { SelectionSnapshot } from './core/types/api.types';
import type { ColumnDef } from './core/types/column.types';
import type { GridEvent } from './core/types/event.types';
import type { GridKey } from './core/types/key.types';
import type { SortSpec } from './core/types/query.types';

interface Row {
  id: number;
  name: string;
  city: string;
  score: number;
}

// jsdom performs no layout, so the viewport reports its size from here and the
// specs assert window math and rendered row keys rather than pixels.
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
  selector: 'lib-datagrid-interaction-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      [key]="key()"
      [rowHeight]="rowHeight()"
      [overscan]="overscan()"
      [(sort)]="sort"
      [sortable]="sortable()"
      [multiSort]="multiSort()"
      [sortCycle]="sortCycle()"
      [selectionMode]="selectionMode()"
      [selectOnRowClick]="selectOnRowClick()"
      [selectAllMode]="selectAllMode()"
      [missingKeys]="missingKeys()"
      [showRowNumbers]="showRowNumbers()"
      [pagingMode]="pagingMode()"
      [(pageSize)]="pageSize"
      [pageSizes]="pageSizes()"
      [(pageIndex)]="pageIndex"
      [flashOnChange]="flashOnChange()"
      [animateRows]="animateRows()"
      [requireTotalCount]="requireTotalCount()"
      [(hiddenColumns)]="hiddenColumns"
      [resizeMode]="resizeMode()"
      [fitColumns]="fitColumns()"
      [allowColumnResize]="allowColumnResize()"
      [allowColumnReorder]="allowColumnReorder()"
      [toggleOnReactivate]="toggleOnReactivate()"
      (selectionChanged)="selection.set($event)"
      (rowActivated)="activated.set($event)"
      (gridEvent)="events.update((all) => [...all, $event])"
    />
  `,
})
class Host {
  readonly columns = signal<ColumnDef<Row>[]>(COLUMNS);
  readonly data = signal<Row[]>(makeRows(1000));
  readonly key = signal<string>('id');
  readonly rowHeight = signal(40);
  readonly overscan = signal(2);
  readonly sort = signal<readonly SortSpec[]>([]);
  readonly sortable = signal(true);
  readonly multiSort = signal(true);
  readonly sortCycle = signal<SortCycle>('asc-desc-none');
  readonly selectionMode = signal<SelectionMode>('none');
  readonly selectOnRowClick = signal(true);
  readonly selectAllMode = signal<'page' | 'allMatching'>('page');
  readonly missingKeys = signal<'keep' | 'drop'>('keep');
  readonly showRowNumbers = signal(false);
  readonly pagingMode = signal<PagingMode>('none');
  readonly pageSize = signal(50);
  readonly pageSizes = signal<readonly number[]>([]);
  readonly pageIndex = signal(0);
  readonly flashOnChange = signal(true);
  readonly animateRows = signal(true);
  readonly requireTotalCount = signal(true);
  readonly hiddenColumns = signal<readonly string[]>([]);
  readonly resizeMode = signal<ResizeMode>('widen');
  readonly fitColumns = signal(false);
  readonly allowColumnResize = signal(true);
  readonly allowColumnReorder = signal(true);
  readonly toggleOnReactivate = signal(false);

  readonly selection = signal<SelectionSnapshot | null>(null);
  readonly activated = signal<{ key: GridKey; row: Row } | null>(null);
  readonly events = signal<readonly GridEvent<Row>[]>([]);
}

describe('Datagrid interaction', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** The grid element itself, not the spec host that wraps it. */
  function grid(): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('lib-datagrid');
    if (found == null) {
      throw new Error('grid not rendered');
    }
    return found;
  }

  /** The grid component instance, for the imperative API and its outputs. */
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

  function rows(): HTMLElement[] {
    return [...viewport().querySelectorAll<HTMLElement>('[role="row"][data-key]')];
  }

  function rowOf(key: string): HTMLElement {
    const found = viewport().querySelector<HTMLElement>(`[role="row"][data-key="${key}"]`);
    if (found == null) {
      throw new Error(`row ${key} not rendered`);
    }
    return found;
  }

  function selectedRows(): HTMLElement[] {
    return [...viewport().querySelectorAll<HTMLElement>('[role="row"][data-selected]')];
  }

  function cellOf(row: HTMLElement, columnId: string): HTMLElement {
    const found = row.querySelector<HTMLElement>(`[role="gridcell"][data-column="${columnId}"]`);
    if (found == null) {
      throw new Error(`cell ${columnId} not rendered`);
    }
    return found;
  }

  function headerCells(): HTMLElement[] {
    return [...viewport().querySelectorAll<HTMLElement>('[role="columnheader"]')];
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

  function headerCaptions(): string[] {
    return headerCells().map((cell) => cell.textContent.trim());
  }

  /** The multi-sort badge of a column, or `null` when it carries none. */
  function sortOrdinal(columnId: string): string | null {
    const badge = headerCell(columnId).querySelector<HTMLElement>('.dg-sort-ordinal');
    return badge == null ? null : badge.textContent.trim();
  }

  async function scrollTo(top: number): Promise<void> {
    const element = viewport();
    Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value: top });
    element.dispatchEvent(new Event('scroll'));
    await settle();
  }

  function pressKey(
    target: HTMLElement,
    key: string,
    modifiers: Partial<KeyboardEventInit> = {},
  ): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }));
  }

  function clickOn(target: HTMLElement, modifiers: Partial<MouseEventInit> = {}): void {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, ...modifiers }));
  }

  /** Presses a cell, which is what moves the roving tabindex onto it. */
  async function focusCell(key: string, columnId: string): Promise<HTMLElement> {
    cellOf(rowOf(key), columnId).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await settle();
    return cellOf(rowOf(key), columnId);
  }

  async function openColumnMenu(columnId: string): Promise<void> {
    pressKey(headerCell(columnId), 'ArrowDown', { altKey: true });
    await settle();
  }

  // Entries that carry state report `menuitemradio`, so a plain `menuitem`
  // selector would silently miss the sort and pin rows.
  function menuItems(): HTMLElement[] {
    return [
      ...document.querySelectorAll<HTMLElement>(
        '.cdk-overlay-pane [role="menuitem"], .cdk-overlay-pane [role="menuitemradio"]',
      ),
    ];
  }

  function menuItem(label: RegExp): HTMLElement {
    const found = menuItems().find((item) => label.test(item.textContent));
    if (found == null) {
      throw new Error(`menu entry ${label.source} not rendered`);
    }
    return found;
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

  describe('sorting', () => {
    it('walks a column through ascending, descending and cleared', async () => {
      clickOn(headerCell('score'));
      await settle();
      expect(headerCell('score').getAttribute('aria-sort')).toBe('ascending');

      clickOn(headerCell('score'));
      await settle();
      expect(headerCell('score').getAttribute('aria-sort')).toBe('descending');

      clickOn(headerCell('score'));
      await settle();
      expect(headerCell('score').getAttribute('aria-sort')).toBe('none');
    });

    it('reorders the rendered rows with the direction, not just the attribute', async () => {
      expect(cellOf(rows()[0], 'name').textContent.trim()).toBe('Row 1');

      clickOn(headerCell('score'));
      await settle();
      expect(cellOf(rows()[0], 'name').textContent.trim()).toBe('Row 1');

      clickOn(headerCell('score'));
      await settle();
      expect(cellOf(rows()[0], 'name').textContent.trim()).toBe('Row 1000');
      expect(rows()[0].getAttribute('data-key')).toBe('1000');
    });

    it('never reaches the cleared state on the two-step cycle', async () => {
      host.sortCycle.set('asc-desc');
      await settle();

      const seen: (string | null)[] = [];
      for (const _step of [0, 1, 2, 3]) {
        void _step;
        clickOn(headerCell('score'));
        await settle();
        seen.push(headerCell('score').getAttribute('aria-sort'));
      }
      expect(seen).toEqual(['ascending', 'descending', 'ascending', 'descending']);
    });

    it('shows no ordinal while a single criterion is active', async () => {
      clickOn(headerCell('name'));
      await settle();
      expect(headerCell('name').getAttribute('aria-sort')).toBe('ascending');
      expect(sortOrdinal('name')).toBeNull();
    });

    it('appends a second criterion on shift-click and numbers both', async () => {
      clickOn(headerCell('name'));
      await settle();
      clickOn(headerCell('city'), { shiftKey: true });
      await settle();

      expect(headerCell('name').getAttribute('aria-sort')).toBe('ascending');
      expect(headerCell('city').getAttribute('aria-sort')).toBe('ascending');
      expect(sortOrdinal('name')).toBe('1');
      expect(sortOrdinal('city')).toBe('2');
    });

    it('replaces rather than appends when multi-sort is off', async () => {
      host.multiSort.set(false);
      await settle();

      clickOn(headerCell('name'));
      await settle();
      clickOn(headerCell('city'), { shiftKey: true });
      await settle();

      expect(headerCell('name').getAttribute('aria-sort')).toBe('none');
      expect(headerCell('city').getAttribute('aria-sort')).toBe('ascending');
      expect(host.sort()).toEqual([{ field: 'city' }]);
    });

    it('refuses a column that disallows sorting, and gives it no aria-sort', async () => {
      host.columns.set([
        { id: 'name', field: 'name', caption: 'Name', width: 200 },
        { id: 'city', field: 'city', caption: 'City', width: 150, allow: { sorting: false } },
        { id: 'score', field: 'score', caption: 'Score', width: 100 },
      ]);
      await settle();

      expect(headerCell('city').getAttribute('aria-sort')).toBeNull();
      clickOn(headerCell('city'));
      await settle();
      expect(headerCell('city').getAttribute('aria-sort')).toBeNull();
      expect(host.sort()).toEqual([]);
    });

    it('sorts on Enter and multi-sorts on Shift+Enter', async () => {
      pressKey(headerCell('name'), 'Enter');
      await settle();
      expect(headerCell('name').getAttribute('aria-sort')).toBe('ascending');

      pressKey(headerCell('city'), 'Enter', { shiftKey: true });
      await settle();
      expect(headerCell('city').getAttribute('aria-sort')).toBe('ascending');
      expect(sortOrdinal('name')).toBe('1');
      expect(sortOrdinal('city')).toBe('2');
    });

    it('writes the criteria back through the two-way model', async () => {
      clickOn(headerCell('score'));
      await settle();
      expect(host.sort()).toEqual([{ field: 'score' }]);

      clickOn(headerCell('score'));
      await settle();
      expect(host.sort()).toEqual([{ field: 'score', desc: true }]);
    });
  });

  describe('selection', () => {
    async function useSelection(mode: SelectionMode): Promise<void> {
      host.selectionMode.set(mode);
      await settle();
    }

    function selectAllInput(): HTMLInputElement {
      const found =
        headerCell(SELECTION_COLUMN_ID).querySelector<HTMLInputElement>('lib-checkbox input');
      if (found == null) {
        throw new Error('select-all checkbox not rendered');
      }
      return found;
    }

    it('renders no selection column when selection is off', () => {
      expect(viewport().querySelector('[data-kind="selection"]')).toBeNull();
      expect(viewport().getAttribute('aria-colcount')).toBe('3');
    });

    it('puts the selection column first and counts it as a column', async () => {
      await useSelection('multiple');
      expect(headerCells()[0].getAttribute('data-kind')).toBe('selection');
      expect(headerCells()[0].getAttribute('data-column')).toBe(SELECTION_COLUMN_ID);
      expect(viewport().getAttribute('aria-colcount')).toBe('4');
      expect(viewport().getAttribute('aria-multiselectable')).toBe('true');
    });

    it('marks a clicked row as selected', async () => {
      await useSelection('multiple');
      clickOn(cellOf(rowOf('3'), 'name'));
      await settle();

      expect(rowOf('3').getAttribute('aria-selected')).toBe('true');
      expect(rowOf('3').hasAttribute('data-selected')).toBe(true);
      expect(rowOf('2').getAttribute('aria-selected')).toBe('false');
      expect(selectedRows().length).toBe(1);
    });

    it('adds with a modifier click and replaces with a plain one', async () => {
      await useSelection('multiple');
      clickOn(cellOf(rowOf('1'), 'name'));
      await settle();
      clickOn(cellOf(rowOf('3'), 'name'), { ctrlKey: true });
      await settle();
      expect(selectedRows().length).toBe(2);

      clickOn(cellOf(rowOf('5'), 'name'), { metaKey: true });
      await settle();
      expect(selectedRows().length).toBe(3);

      clickOn(cellOf(rowOf('7'), 'name'));
      await settle();
      expect(selectedRows().map((row) => row.getAttribute('data-key'))).toEqual(['7']);
    });

    it('selects the inclusive range on shift-click', async () => {
      await useSelection('multiple');
      clickOn(cellOf(rowOf('2'), 'name'));
      await settle();
      clickOn(cellOf(rowOf('6'), 'name'), { shiftKey: true });
      await settle();

      expect(selectedRows().map((row) => row.getAttribute('data-key'))).toEqual([
        '2',
        '3',
        '4',
        '5',
        '6',
      ]);
      const snapshot = host.selection();
      if (snapshot?.kind !== 'keys') {
        throw new Error('expected a keyed selection snapshot');
      }
      expect(snapshot.keys.length).toBe(5);
    });

    it('keeps an earlier checkbox range when a second one starts', async () => {
      await useSelection('multiple');
      clickOn(cellOf(rowOf('2'), SELECTION_COLUMN_ID));
      await settle();
      clickOn(cellOf(rowOf('5'), SELECTION_COLUMN_ID), { shiftKey: true });
      await settle();
      clickOn(cellOf(rowOf('8'), SELECTION_COLUMN_ID));
      await settle();
      clickOn(cellOf(rowOf('10'), SELECTION_COLUMN_ID), { shiftKey: true });
      await settle();

      expect(selectedRows().map((row) => row.getAttribute('data-key'))).toEqual([
        '2',
        '3',
        '4',
        '5',
        '8',
        '9',
        '10',
      ]);
    });

    it('releases only the rows the previous range added when it shrinks', async () => {
      await useSelection('multiple');
      clickOn(cellOf(rowOf('9'), SELECTION_COLUMN_ID));
      await settle();
      clickOn(cellOf(rowOf('2'), SELECTION_COLUMN_ID));
      await settle();
      clickOn(cellOf(rowOf('5'), SELECTION_COLUMN_ID), { shiftKey: true });
      await settle();
      clickOn(cellOf(rowOf('3'), SELECTION_COLUMN_ID), { shiftKey: true });
      await settle();

      expect(selectedRows().map((row) => row.getAttribute('data-key'))).toEqual(['2', '3', '9']);
    });

    it('extends from the same anchor with Shift+ArrowDown and keeps earlier rows', async () => {
      await useSelection('multiple');
      clickOn(cellOf(rowOf('7'), SELECTION_COLUMN_ID));
      await settle();
      const cell = await focusCell('2', 'name');
      pressKey(cell, ' ');
      await settle();

      pressKey(await focusCell('2', 'name'), 'ArrowDown', { shiftKey: true });
      await settle();
      pressKey(cellOf(rowOf('3'), 'name'), 'ArrowDown', { shiftKey: true });
      await settle();

      expect(selectedRows().map((row) => row.getAttribute('data-key'))).toEqual([
        '2',
        '3',
        '4',
        '7',
      ]);
    });

    it('toggles the focused row with Space', async () => {
      await useSelection('multiple');
      const cell = await focusCell('4', 'name');

      pressKey(cell, ' ');
      await settle();
      expect(rowOf('4').hasAttribute('data-selected')).toBe(true);

      pressKey(await focusCell('4', 'name'), ' ');
      await settle();
      expect(rowOf('4').hasAttribute('data-selected')).toBe(false);
    });

    it('selects every loaded row with Ctrl+A in multiple mode', async () => {
      await useSelection('multiple');
      pressKey(await focusCell('1', 'name'), 'a', { ctrlKey: true });
      await settle();

      const snapshot = host.selection();
      if (snapshot?.kind !== 'keys') {
        throw new Error('expected a keyed selection snapshot');
      }
      expect(snapshot.keys.length).toBe(1000);
      expect(selectedRows().length).toBe(rows().length);
    });

    it('ignores Ctrl+A in single mode', async () => {
      await useSelection('single');
      pressKey(await focusCell('1', 'name'), 'a', { ctrlKey: true });
      await settle();

      expect(selectedRows().length).toBe(0);
    });

    it('reports the select-all checkbox as mixed while only some rows are selected', async () => {
      await useSelection('multiple');
      expect(selectAllInput().indeterminate).toBe(false);
      expect(selectAllInput().checked).toBe(false);

      clickOn(cellOf(rowOf('3'), 'name'));
      await settle();
      expect(selectAllInput().indeterminate).toBe(true);
      expect(selectAllInput().checked).toBe(false);

      pressKey(await focusCell('3', 'name'), 'a', { ctrlKey: true });
      await settle();
      expect(selectAllInput().indeterminate).toBe(false);
      expect(selectAllInput().checked).toBe(true);
    });

    it('keeps a data-cell click inert when only the checkbox may select', async () => {
      await useSelection('multiple');
      host.selectOnRowClick.set(false);
      await settle();

      clickOn(cellOf(rowOf('3'), 'name'));
      await settle();
      expect(selectedRows().length).toBe(0);

      clickOn(cellOf(rowOf('3'), SELECTION_COLUMN_ID));
      await settle();
      expect(rowOf('3').hasAttribute('data-selected')).toBe(true);
    });

    it('emits the selection as a keyed snapshot', async () => {
      await useSelection('multiple');
      clickOn(cellOf(rowOf('3'), 'name'));
      await settle();

      const snapshot = host.selection();
      if (snapshot?.kind !== 'keys') {
        throw new Error('expected a keyed selection snapshot');
      }
      expect(snapshot.keys).toEqual([3]);
    });

    it('emits a predicate snapshot, with no key list, for select-all-matching', async () => {
      await useSelection('multiple');
      host.selectAllMode.set('allMatching');
      await settle();

      pressKey(await focusCell('1', 'name'), 'a', { ctrlKey: true });
      await settle();

      const snapshot = host.selection();
      if (snapshot?.kind !== 'allMatching') {
        throw new Error('expected an all-matching selection snapshot');
      }
      expect(snapshot.exclusions).toEqual([]);
      expect('keys' in snapshot).toBe(false);
      expect(selectedRows().length).toBe(rows().length);
    });

    it('activates a row on double click', async () => {
      await useSelection('multiple');
      cellOf(rowOf('4'), 'name').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();

      expect(host.activated()?.key).toBe(4);
      expect(host.activated()?.row.name).toBe('Row 4');
    });

    it('clears the selection when the selected row is re-activated', async () => {
      await useSelection('single');
      host.toggleOnReactivate.set(true);
      await settle();

      clickOn(cellOf(rowOf('4'), 'name'));
      await settle();
      expect(rowOf('4').hasAttribute('data-selected')).toBe(true);

      cellOf(rowOf('4'), 'name').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      expect(host.activated()?.key).toBe(4);
      expect(rowOf('4').hasAttribute('data-selected')).toBe(false);
    });

    it('keeps the selection by key across a data reload', async () => {
      await useSelection('multiple');
      clickOn(cellOf(rowOf('3'), 'name'));
      await settle();

      host.data.set(makeRows(1000));
      await settle();

      expect(rowOf('3').hasAttribute('data-selected')).toBe(true);
      expect(selectedRows().length).toBe(1);
    });

    // Every key is missing when nothing came back, so `'drop'` drops them.
    // Keeping them would let a later source that reuses a key resurrect a
    // selection the user never made.
    it('drops the selection when a reload returns nothing', async () => {
      host.missingKeys.set('drop');
      await useSelection('multiple');
      clickOn(cellOf(rowOf('3'), 'name'));
      await settle();
      expect(gridComponent().api().getSelectedKeys()).toEqual([3]);

      host.data.set([]);
      await settle();

      expect(gridComponent().api().getSelectedKeys()).toEqual([]);
    });

    // WAI-ARIA has Shift+Down extend the selection from the current focus, so
    // the range starts where the user is standing, not where they land.
    it('takes both rows on the first Shift+ArrowDown', async () => {
      await useSelection('multiple');
      pressKey(await focusCell('2', 'name'), 'ArrowDown', { shiftKey: true });
      await settle();

      expect(gridComponent().api().getSelectedKeys()).toEqual([2, 3]);
    });
  });

  describe('row numbers', () => {
    beforeEach(async () => {
      host.showRowNumbers.set(true);
      await settle();
    });

    it('renders a row number column ahead of the data columns', () => {
      expect(headerCells()[0].getAttribute('data-kind')).toBe('rowNumber');
      expect(cellOf(rowOf('1'), ROW_NUMBER_COLUMN_ID).textContent.trim()).toBe('1');
      expect(cellOf(rowOf('2'), ROW_NUMBER_COLUMN_ID).textContent.trim()).toBe('2');
    });

    it('numbers a scrolled row by its absolute index, not its position in the window', async () => {
      await scrollTo(4000);
      const first = rows()[0];
      expect(first.getAttribute('data-key')).toBe('99');
      expect(cellOf(first, ROW_NUMBER_COLUMN_ID).textContent.trim()).toBe('99');
    });

    it('turns the column on and off from the column menu', async () => {
      host.showRowNumbers.set(false);
      await settle();
      expect(headerCells()[0].getAttribute('data-kind')).toBeNull();

      await openColumnMenu('name');
      clickOn(menuItem(/show row numbers/i));
      await settle();
      expect(headerCells()[0].getAttribute('data-kind')).toBe('rowNumber');

      await openColumnMenu('name');
      clickOn(menuItem(/hide row numbers/i));
      await settle();
      expect(headerCells()[0].getAttribute('data-kind')).toBeNull();
    });
  });

  describe('column UX', () => {
    it('checks the sort direction in force without disabling it', async () => {
      clickOn(headerCell('name'));
      await settle();
      await openColumnMenu('name');

      const asc = menuItem(/ascending/i);
      expect(asc.getAttribute('role')).toBe('menuitemradio');
      expect(asc.getAttribute('aria-checked')).toBe('true');
      // Re-picking the direction in force is a harmless no-op. Disabling it
      // would announce the user's own choice as unavailable and take away the
      // keyboard landing spot they were aiming for.
      expect(asc.getAttribute('aria-disabled')).not.toBe('true');
      expect(menuItem(/descending/i).getAttribute('aria-checked')).toBe('false');
      // "Unpin" is an action, never a side in force: it stays unchecked and
      // goes disabled while the column carries no pin.
      const unpin = menuItem(/unpin/i);
      expect(unpin.getAttribute('aria-checked')).not.toBe('true');
      expect(unpin.getAttribute('aria-disabled')).toBe('true');
    });

    it('enables "unpin" without checking it once the column is pinned', async () => {
      await openColumnMenu('name');
      clickOn(menuItem(/pin to start/i));
      await settle();
      await openColumnMenu('name');

      const unpin = menuItem(/unpin/i);
      expect(unpin.getAttribute('aria-checked')).not.toBe('true');
      expect(unpin.getAttribute('aria-disabled')).not.toBe('true');
    });

    it('hides a column from the header menu and writes the id back', async () => {
      await openColumnMenu('city');
      const hide = menuItems().find((item) => /hide/i.test(item.textContent));
      if (hide == null) {
        throw new Error('hide entry not rendered');
      }
      clickOn(hide);
      await settle();

      expect(host.hiddenColumns()).toEqual(['city']);
      expect(headerCaptions()).toEqual(['Name', 'Score']);
    });

    it('refuses to hide a column that disallows hiding', async () => {
      host.columns.set([
        { id: 'name', field: 'name', caption: 'Name', width: 200 },
        { id: 'city', field: 'city', caption: 'City', width: 150, allow: { hiding: false } },
        { id: 'score', field: 'score', caption: 'Score', width: 100 },
      ]);
      await settle();

      // The menu withholds the entry rather than disabling it: an enabled item
      // that silently does nothing is worse than no item.
      await openColumnMenu('city');
      expect(menuItems().find((item) => /hide/i.test(item.textContent))).toBeUndefined();

      await openColumnMenu('name');
      expect(menuItems().find((item) => /hide/i.test(item.textContent))).toBeDefined();

      expect(host.hiddenColumns()).toEqual([]);
      expect(headerCaptions()).toEqual(['Name', 'City', 'Score']);
    });

    // The header carries no menu icon. Right-click and Alt+Down are the two
    // ways in, so a plain press anywhere in the cell belongs to the sort.
    it('draws no column menu trigger, and a plain press sorts', async () => {
      expect(headerCell('name').querySelector('[data-column-menu]')).toBeNull();

      clickOn(headerCell('name'));
      await settle();

      expect(menuItems()).toHaveLength(0);
      expect(headerCell('name').getAttribute('aria-sort')).toBe('ascending');
    });

    it('opens the column menu on right-click and suppresses the browser menu', async () => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: 40,
      });
      headerCell('name').dispatchEvent(event);
      await settle();

      expect(event.defaultPrevented).toBe(true);
      expect(menuItems().length).toBeGreaterThan(0);
      expect(host.sort()).toEqual([]);
    });

    it('leaves the browser menu alone on a built-in column', async () => {
      host.selectionMode.set('multiple');
      await settle();
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 40,
      });
      headerCell(SELECTION_COLUMN_ID).dispatchEvent(event);
      await settle();

      expect(event.defaultPrevented).toBe(false);
      expect(menuItems().length).toBe(0);
    });

    it('widens a column with Ctrl+ArrowRight', async () => {
      expect(grid().style.getPropertyValue('--dg-template')).toBe('200px 150px 100px');

      pressKey(headerCell('name'), 'ArrowRight', { ctrlKey: true });
      await settle();

      expect(grid().style.getPropertyValue('--dg-template')).toBe('216px 150px 100px');
    });

    // `fitColumns` holds the total at the container width, so a resize has to
    // move the boundary between two columns. Widening under fit would push the
    // total past the container and the fit pass would take the difference
    // straight back out on the next frame.
    it('takes a resize out of the neighbour under fitColumns, whatever the resize mode', async () => {
      host.fitColumns.set(true);
      await settle();
      const fitted = grid().style.getPropertyValue('--dg-template');
      const widths = fitted.split(' ').map((width) => Number.parseInt(width, 10));
      const total = widths.reduce((sum, width) => sum + width, 0);
      expect(widths[0]).toBeGreaterThan(200);

      // The step lands whole on the dragged column and comes whole out of the
      // next one. Before, the write fed the fit pass a surplus it spread over
      // every column again, and the column grew on a step that asked it to
      // shrink.
      pressKey(headerCell('name'), 'ArrowRight', { ctrlKey: true });
      await settle();
      expect(grid().style.getPropertyValue('--dg-template')).toBe(
        `${(widths[0] + 16).toString()}px ${(widths[1] - 16).toString()}px ${widths[2].toString()}px`,
      );

      pressKey(headerCell('name'), 'ArrowLeft', { ctrlKey: true });
      await settle();
      expect(grid().style.getPropertyValue('--dg-template')).toBe(fitted);
      expect(total).toBe(
        grid()
          .style.getPropertyValue('--dg-template')
          .split(' ')
          .reduce((sum, width) => sum + Number.parseInt(width, 10), 0),
      );
    });

    it('renders no resize handle when resizing is off', async () => {
      expect(viewport().querySelectorAll('[data-resize-handle]').length).toBe(3);

      host.allowColumnResize.set(false);
      await settle();
      expect(viewport().querySelectorAll('[data-resize-handle]').length).toBe(0);
    });

    it('moves a column one position with Ctrl+Shift+ArrowRight', async () => {
      pressKey(headerCell('name'), 'ArrowRight', { ctrlKey: true, shiftKey: true });
      await settle();

      expect(headerCaptions()).toEqual(['City', 'Name', 'Score']);
    });

    // The swap happens under the pointer, so what the user releases over is
    // already what they see. jsdom lays nothing out and implements no pointer
    // capture, so the geometry is stubbed and the motion itself is a browser
    // check — see `swapTarget` for the rule these drags exercise.
    describe('reorder drag', () => {
      /** The header host, which is what captures the pointer and hears the moves. */
      function header(): HTMLElement {
        const found = grid().querySelector<HTMLElement>('lib-datagrid-header');
        if (found == null) {
          throw new Error('header not rendered');
        }
        return found;
      }

      function layOutHeader(boxes: readonly (readonly [string, number, number])[]): void {
        for (const [columnId, start, width] of boxes) {
          const cell = headerCell(columnId);
          Object.defineProperty(cell, 'offsetLeft', { value: start, configurable: true });
          Object.defineProperty(cell, 'offsetWidth', { value: width, configurable: true });
        }
      }

      function pointer(type: string, clientX: number): PointerEvent {
        return new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX });
      }

      function movedColumns(): unknown[] {
        return host
          .events()
          .filter((event) => event.name === 'columnMoved')
          .map((event) => event.payload);
      }

      beforeEach(() => {
        layOutHeader([
          ['name', 0, 200],
          ['city', 200, 150],
          ['score', 350, 100],
        ]);
      });

      it('swaps the columns while the pointer is still down', async () => {
        headerCell('name').dispatchEvent(pointer('pointerdown', 50));
        header().dispatchEvent(pointer('pointermove', 260));
        await settle();

        // Still on the near half of City: the drag has to earn the swap.
        expect(headerCaptions()).toEqual(['Name', 'City', 'Score']);

        header().dispatchEvent(pointer('pointermove', 290));
        await settle();

        expect(headerCaptions()).toEqual(['City', 'Name', 'Score']);
        // The cell the ghost came out of, which is the gap the drop lands in.
        expect(headerCell('name').getAttribute('data-dragging')).toBe('');
      });

      it('reports the move once, when the drag lets go', async () => {
        headerCell('name').dispatchEvent(pointer('pointerdown', 50));
        header().dispatchEvent(pointer('pointermove', 290));
        await settle();

        // §20: a burst of intermediate reports from one action is forbidden.
        expect(movedColumns()).toEqual([]);

        header().dispatchEvent(pointer('pointerup', 290));
        await settle();

        expect(movedColumns()).toEqual([{ columnId: 'name', visibleIndex: 1 }]);
        expect(headerCaptions()).toEqual(['City', 'Name', 'Score']);
        expect(headerCell('name').getAttribute('data-dragging')).toBeNull();
      });

      it('leaves a press that never moved as a sort', async () => {
        headerCell('name').dispatchEvent(pointer('pointerdown', 50));
        header().dispatchEvent(pointer('pointerup', 50));
        clickOn(headerCell('name'));
        await settle();

        expect(headerCaptions()).toEqual(['Name', 'City', 'Score']);
        expect(host.sort()).toEqual([{ field: 'name' }]);
      });

      it('does not reorder when reordering is off', async () => {
        host.allowColumnReorder.set(false);
        await settle();
        layOutHeader([
          ['name', 0, 200],
          ['city', 200, 150],
          ['score', 350, 100],
        ]);

        headerCell('name').dispatchEvent(pointer('pointerdown', 50));
        header().dispatchEvent(pointer('pointermove', 290));
        header().dispatchEvent(pointer('pointerup', 290));
        await settle();

        expect(headerCaptions()).toEqual(['Name', 'City', 'Score']);
        expect(movedColumns()).toEqual([]);
      });
    });

    it('leaves the grid’s own columns unresizable', async () => {
      host.selectionMode.set('multiple');
      host.showRowNumbers.set(true);
      await settle();

      expect(headerCell(SELECTION_COLUMN_ID).querySelector('[data-resize-handle]')).toBeNull();
      expect(headerCell(ROW_NUMBER_COLUMN_ID).querySelector('[data-resize-handle]')).toBeNull();
      expect(headerCell('name').querySelector('[data-resize-handle]')).not.toBeNull();
    });
  });

  // The animation is only worth playing when every row has a destination on
  // screen. jsdom has no WAAPI, so these assert the gate the grid passes down
  // rather than the motion itself — the motion is a browser check.
  describe('row reorder animation', () => {
    function body(): HTMLElement {
      const found = grid().querySelector<HTMLElement>('lib-datagrid-body');
      if (found == null) {
        throw new Error('body not rendered');
      }
      return found;
    }

    it('stays off while the dataset is virtualized', () => {
      expect(rows().length).toBeLessThan(host.data().length);
      expect(body().getAttribute('data-animate-reorder')).toBeNull();
    });

    it('turns on once every row is rendered', async () => {
      host.data.set(makeRows(5));
      await settle();

      expect(rows().length).toBe(5);
      expect(body().getAttribute('data-animate-reorder')).toBe('');
    });

    it('stays off when the host opts out', async () => {
      host.data.set(makeRows(5));
      host.animateRows.set(false);
      await settle();

      expect(body().getAttribute('data-animate-reorder')).toBeNull();
    });

    it('stays off when there are no rows at all', async () => {
      host.data.set([]);
      await settle();

      expect(body().getAttribute('data-animate-reorder')).toBeNull();
    });
  });

  // The flash marks a value that changed under the user. Everything that
  // merely moves values around must stay silent, or the signal is worthless.
  describe('cell flash', () => {
    function flashOf(key: string, columnId: string): string | null {
      return cellOf(rowOf(key), columnId).getAttribute('data-flash');
    }

    /** Same keys, one changed value. */
    function withNameChanged(key: number, name: string): Row[] {
      return host.data().map((row) => (row.id === key ? { ...row, name } : { ...row }));
    }

    it('does not flash on the first load', () => {
      expect(flashOf('1', 'name')).toBeNull();
      expect(flashOf('2', 'name')).toBeNull();
    });

    it('flashes only the cell whose value changed', async () => {
      host.data.set(withNameChanged(1, 'Renamed'));
      await settle();

      expect(flashOf('1', 'name')).not.toBeNull();
      expect(flashOf('1', 'city')).toBeNull();
      expect(flashOf('2', 'name')).toBeNull();
    });

    it('alternates the parity so a second change re-triggers', async () => {
      host.data.set(withNameChanged(1, 'First'));
      await settle();
      const first = flashOf('1', 'name');

      host.data.set(withNameChanged(1, 'Second'));
      await settle();
      const second = flashOf('1', 'name');

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(second).not.toBe(first);
    });

    it('stays silent when a refresh changes nothing', async () => {
      host.data.set(host.data().map((row) => ({ ...row })));
      await settle();

      expect(flashOf('1', 'name')).toBeNull();
    });

    it('stays silent when a sort only moves rows', async () => {
      clickOn(headerCell('name'));
      await settle();
      clickOn(headerCell('name'));
      await settle();

      for (const row of rows().slice(0, 5)) {
        expect(cellOf(row, 'name').getAttribute('data-flash')).toBeNull();
      }
    });

    /** What a projecting source returns while a column is hidden. */
    function withoutCity(): Row[] {
      return host.data().map(({ city: _city, ...rest }) => {
        void _city;
        return rest as Row;
      });
    }

    it('stays silent when a column arrives and the field it projects lands after it', async () => {
      host.hiddenColumns.set(['city']);
      host.data.set(withoutCity());
      await settle();

      // The chooser shows the column. The rows on screen still carry no city,
      // so the cells render empty, and the re-query lands one render later.
      host.hiddenColumns.set([]);
      await settle();
      host.data.set(makeRows(1000));
      await settle();

      for (const row of rows().slice(0, 5)) {
        expect(cellOf(row, 'city').getAttribute('data-flash')).toBeNull();
      }
    });

    it('flashes that column again once its data really changes', async () => {
      host.hiddenColumns.set(['city']);
      host.data.set(withoutCity());
      await settle();
      host.hiddenColumns.set([]);
      await settle();
      host.data.set(makeRows(1000));
      await settle();

      host.data.set(host.data().map((row) => (row.id === 1 ? { ...row, city: 'Larnaca' } : row)));
      await settle();

      expect(flashOf('1', 'city')).not.toBeNull();
      expect(flashOf('2', 'city')).toBeNull();
    });

    it('honours flashOnChange being off', async () => {
      host.flashOnChange.set(false);
      host.data.set(withNameChanged(1, 'Renamed'));
      await settle();

      expect(flashOf('1', 'name')).toBeNull();
    });
  });

  describe('paging', () => {
    function pager(): HTMLElement | null {
      return grid().querySelector<HTMLElement>('lib-paginator');
    }

    function loadMore(): HTMLElement | null {
      return grid().querySelector<HTMLElement>('.dg-load-more button');
    }

    it('renders no pager while paging is off', () => {
      expect(pager()).toBeNull();
      expect(loadMore()).toBeNull();
    });

    it('renders the pager when a total count is required', async () => {
      host.pagingMode.set('pager');
      await settle();

      expect(pager()).not.toBeNull();
      expect(loadMore()).toBeNull();
      expect(rows().length).toBeLessThan(20);
    });

    it('falls back to load more when no total count is available', async () => {
      host.pagingMode.set('pager');
      host.requireTotalCount.set(false);
      await settle();

      expect(pager()).toBeNull();
      expect(loadMore()).not.toBeNull();
    });

    // `aria-rowcount` reserves -1 for a partial view of an unknown whole.
    // Counting the loaded page instead would announce it as the dataset.
    it('reports an unknown total as -1 rather than as the loaded page', async () => {
      host.pagingMode.set('pager');
      host.requireTotalCount.set(false);
      await settle();

      expect(viewport().getAttribute('aria-rowcount')).toBe('-1');

      host.requireTotalCount.set(true);
      await settle();
      expect(viewport().getAttribute('aria-rowcount')).toBe('1001');
    });

    it('keeps row numbers absolute across a page change', async () => {
      host.pagingMode.set('pager');
      host.showRowNumbers.set(true);
      await settle();
      expect(cellOf(rows()[0], ROW_NUMBER_COLUMN_ID).textContent.trim()).toBe('1');

      const second = [...grid().querySelectorAll<HTMLElement>('.paginator-pages button')].find(
        (button) => button.textContent.trim() === '2',
      );
      if (second == null) {
        throw new Error('page 2 link not rendered');
      }
      clickOn(second);
      await settle();

      expect(rows()[0].getAttribute('data-key')).toBe('51');
      expect(cellOf(rows()[0], ROW_NUMBER_COLUMN_ID).textContent.trim()).toBe('51');
    });

    function pagerRow(): HTMLElement | null {
      return grid().querySelector<HTMLElement>('.dg-pager-row');
    }

    /**
     * The size buttons, which is the form an unmeasured row draws — jsdom
     * measures nothing, so every grid here has the width for them.
     */
    function sizeButtons(): HTMLElement[] {
      return [...grid().querySelectorAll<HTMLElement>('.dg-page-sizes button')];
    }

    function pickSize(label: string): void {
      const button = sizeButtons().find((item) => item.textContent.trim() === label);
      if (button == null) {
        throw new Error(`page size ${label} not offered`);
      }
      clickOn(button);
    }

    it('offers no page-size control until sizes are declared', async () => {
      host.pagingMode.set('pager');
      await settle();

      expect(sizeButtons()).toHaveLength(0);
      expect(grid().querySelector('.dg-page-size')).toBeNull();
      expect(pagerRow()?.hasAttribute('data-page-size')).toBe(false);
    });

    it('draws the sizes at the other end of the row from the pager', async () => {
      host.pagingMode.set('pager');
      host.pageSizes.set([10, 25, 50]);
      await settle();

      expect(sizeButtons().map((button) => button.textContent.trim())).toEqual(['10', '25', '50']);
      // The flag the row's own styles read to cap the pager at half the width.
      expect(pagerRow()?.hasAttribute('data-page-size')).toBe(true);
    });

    it('marks the size the rows are paged by', async () => {
      host.pagingMode.set('pager');
      host.pageSizes.set([10, 25, 50]);
      await settle();

      expect(
        sizeButtons()
          .filter((button) => button.getAttribute('aria-pressed') === 'true')
          .map((button) => button.textContent.trim()),
      ).toEqual(['50']);
    });

    it('offers the size in force even when it was not among the choices', async () => {
      host.pageSize.set(50);
      host.pagingMode.set('pager');
      host.pageSizes.set([10, 25]);
      await settle();

      expect(sizeButtons().map((button) => button.textContent.trim())).toEqual(['10', '25', '50']);
    });

    it('re-pages from the first page on the size it picks', async () => {
      host.pagingMode.set('pager');
      host.pageSizes.set([10, 25, 50]);
      await settle();

      const second = [...grid().querySelectorAll<HTMLElement>('.paginator-pages button')].find(
        (button) => button.textContent.trim() === '2',
      );
      if (second == null) {
        throw new Error('page 2 link not rendered');
      }
      clickOn(second);
      await settle();
      expect(host.pageIndex()).toBe(1);

      pickSize('10');
      await settle();

      expect(host.pageSize()).toBe(10);
      // A size change is a different set of pages, so the index cannot mean
      // what it meant: the store snaps it back and the model follows.
      expect(host.pageIndex()).toBe(0);
      expect(rows()[0].getAttribute('data-key')).toBe('1');
    });

    it('still advances after a sort has reset the page index', async () => {
      host.pagingMode.set('pager');
      await settle();

      const goTo = async (label: string): Promise<void> => {
        const link = [...grid().querySelectorAll<HTMLElement>('.paginator-pages button')].find(
          (button) => button.textContent.trim() === label,
        );
        if (link == null) {
          throw new Error(`page ${label} link not rendered`);
        }
        clickOn(link);
        await settle();
      };

      await goTo('2');
      expect(rows()[0].getAttribute('data-key')).toBe('51');

      // Sorting snaps back to the first page inside the query store. The
      // grid's own `pageIndex` has to learn about that, or the next pager
      // click writes a value it already holds and nothing reloads.
      clickOn(headerCell('score'));
      await settle();
      expect(host.pageIndex()).toBe(0);

      await goTo('2');
      expect(host.pageIndex()).toBe(1);
      expect(rows()[0].getAttribute('data-key')).not.toBe('1');
    });
  });
});
