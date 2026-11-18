import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { Datagrid } from './datagrid';
import { DatagridCellTemplate } from './datagrid-templates';
import type { ColumnDef } from './core/types/column.types';
import type { FilterNode } from './core/types/filter.types';
import type { GridDataSource, QueryResult } from './core/types/query.types';

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
  selector: 'lib-datagrid-host',
  imports: [Datagrid, DatagridCellTemplate],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      [key]="key()"
      [rowHeight]="rowHeight()"
      [overscan]="overscan()"
      [filter]="filter()"
      [striped]="striped()"
      [density]="density()"
      [decorateRow]="decorateRow()"
      [ariaLabel]="ariaLabel()"
    >
      @if (withCellTemplate()) {
        <ng-template libDatagridCell="city" let-cell>
          <span class="custom-cell">{{ cell.displayValue }}!</span>
        </ng-template>
      }
    </lib-datagrid>
  `,
})
class Host {
  readonly columns = signal<ColumnDef<Row>[]>(COLUMNS);
  readonly data = signal<Row[] | GridDataSource<Row>>(makeRows(1000));
  readonly key = signal<string>('id');
  readonly rowHeight = signal(40);
  readonly overscan = signal(2);
  readonly filter = signal<FilterNode | null>(null);
  readonly striped = signal(false);
  readonly density = signal<'compact' | 'standard' | 'comfortable'>('standard');
  readonly decorateRow = signal<
    | ((row: Row) => {
        classes?: string[];
        styles?: Record<string, string>;
        aria?: Record<string, string>;
      } | null)
    | null
  >(null);
  readonly ariaLabel = signal('Bookings');
  readonly withCellTemplate = signal(false);
}

describe('Datagrid', () => {
  let fixture: ComponentFixture<Host>;

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

  function renderedKeys(): (string | null)[] {
    return rows().map((row) => row.getAttribute('data-key'));
  }

  function cellsOf(row: HTMLElement): HTMLElement[] {
    return [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')];
  }

  function headerCaptions(): string[] {
    return [...viewport().querySelectorAll<HTMLElement>('[role="columnheader"]')].map((cell) =>
      cell.textContent.trim(),
    );
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
    await settle();
  });

  describe('virtualization', () => {
    it('renders only the rows inside the window, not the whole dataset', async () => {
      await settle();
      const keys = renderedKeys();
      // 400px viewport / 40px rows = 10 rows, plus one partial and 2 overscan.
      expect(keys.length).toBeLessThan(20);
      expect(keys.length).toBeGreaterThan(9);
      expect(keys[0]).toBe('1');
    });

    it('moves the window when the viewport scrolls', async () => {
      await scrollTo(4000);
      const keys = renderedKeys();
      expect(keys).not.toContain('1');
      // 4000 / 40 = row index 100, which is key 101, less the overscan.
      expect(keys[0]).toBe('99');
    });

    it('reports the total dataset in aria-rowcount, not the rendered window', () => {
      expect(viewport().getAttribute('aria-rowcount')).toBe('1001');
      expect(viewport().getAttribute('aria-colcount')).toBe('3');
      expect(rows().length).toBeLessThan(20);
    });

    it('gives each row its absolute aria-rowindex', async () => {
      await scrollTo(4000);
      const first = rows()[0];
      // Header is row 1, so the data row at index 98 announces as 100.
      expect(first.getAttribute('aria-rowindex')).toBe('100');
    });

    it('positions rows at their absolute offset', () => {
      const first = rows()[0];
      expect(first.style.top).toBe('0px');
      expect(rows()[1].style.top).toBe('40px');
    });

    it('sizes the canvas to the whole dataset so the scrollbar is correct', () => {
      const body = viewport().querySelector<HTMLElement>('lib-datagrid-body');
      if (body == null) {
        throw new Error('body not rendered');
      }
      expect(body.style.height).toBe('40000px');
    });
  });

  describe('columns', () => {
    it('renders captions in declaration order', () => {
      expect(headerCaptions()).toEqual(['Name', 'City', 'Score']);
    });

    it('hoists pinned columns to the edges and gives them sticky insets', async () => {
      fixture.componentInstance.columns.set([
        { id: 'name', field: 'name', caption: 'Name', width: 200 },
        { id: 'city', field: 'city', caption: 'City', width: 150, pinned: 'start' },
        { id: 'score', field: 'score', caption: 'Score', width: 100, pinned: 'end' },
      ]);
      await settle();
      expect(headerCaptions()).toEqual(['City', 'Name', 'Score']);

      const cells = cellsOf(rows()[0]);
      expect(cells[0].getAttribute('data-pinned')).toBe('start');
      expect(cells[0].style.left).toBe('0px');
      expect(cells[0].getAttribute('data-edge')).toBe('');
      expect(cells[1].getAttribute('data-pinned')).toBeNull();
      expect(cells[2].getAttribute('data-pinned')).toBe('end');
      expect(cells[2].style.right).toBe('0px');
    });

    it('omits hidden columns from the render and from aria-colcount', async () => {
      fixture.componentInstance.columns.set([
        { id: 'name', field: 'name', caption: 'Name' },
        { id: 'city', field: 'city', caption: 'City', visible: false },
      ]);
      await settle();
      expect(headerCaptions()).toEqual(['Name']);
      expect(viewport().getAttribute('aria-colcount')).toBe('1');
    });

    it('follows the definitions when a host flips a column back to visible', async () => {
      fixture.componentInstance.columns.set([
        { id: 'name', field: 'name', caption: 'Name' },
        { id: 'city', field: 'city', caption: 'City', visible: false },
      ]);
      await settle();
      fixture.componentInstance.columns.set([
        { id: 'name', field: 'name', caption: 'Name' },
        { id: 'city', field: 'city', caption: 'City' },
      ]);
      await settle();
      expect(headerCaptions()).toEqual(['Name', 'City']);
    });
  });

  describe('cell pipeline', () => {
    it('renders formatted text on the fast path', () => {
      const cells = cellsOf(rows()[0]);
      expect(cells[0].textContent.trim()).toBe('Row 1');
      expect(cells[1].textContent.trim()).toBe('Nicosia');
    });

    it('renders a host template instead of the fast path for its column', async () => {
      fixture.componentInstance.withCellTemplate.set(true);
      await settle();
      const custom = rows()[0].querySelector('.custom-cell');
      if (custom == null) {
        throw new Error('cell template not rendered');
      }
      expect(custom.textContent.trim()).toBe('Nicosia!');
    });

    it('applies host row decoration classes', async () => {
      fixture.componentInstance.decorateRow.set((row) =>
        row.score === 0 ? { classes: ['is-zero'] } : null,
      );
      await settle();
      expect(rows()[0].classList.contains('is-zero')).toBe(true);
      expect(rows()[1].classList.contains('is-zero')).toBe(false);
    });

    it('applies host row decoration styles and ARIA', async () => {
      fixture.componentInstance.decorateRow.set((row) =>
        row.score === 0
          ? { styles: { 'font-weight': '700' }, aria: { 'aria-invalid': 'true' } }
          : null,
      );
      await settle();
      expect(rows()[0].style.fontWeight).toBe('700');
      expect(rows()[0].getAttribute('aria-invalid')).toBe('true');
      expect(rows()[1].getAttribute('aria-invalid')).toBeNull();
    });

    it('refuses decoration ARIA that would contradict the grid structure', async () => {
      fixture.componentInstance.decorateRow.set(() => ({
        aria: { 'aria-rowindex': '99', 'aria-label': 'kept' },
      }));
      await settle();
      expect(rows()[0].getAttribute('aria-rowindex')).toBe('2');
      expect(rows()[0].getAttribute('aria-label')).toBe('kept');
    });
  });

  describe('keyboard model', () => {
    async function enterGrid(): Promise<HTMLElement> {
      const cell = cellsOf(rows()[0])[0];
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      return cell;
    }

    it('keeps exactly one cell in the tab order', async () => {
      await enterGrid();
      const focusable = viewport().querySelectorAll('[role="gridcell"][tabindex="0"]');
      expect(focusable.length).toBe(1);
      expect(viewport().getAttribute('tabindex')).toBe('-1');
    });

    it('is a single tab stop before any cell is focused', () => {
      expect(viewport().getAttribute('tabindex')).toBe('0');
    });

    it('enters the grid when a navigation key arrives on the container', async () => {
      // Regression: the keyboard must never dead-end on the wrapper, which it
      // would if only cells handled navigation keys.
      pressKey(viewport(), 'ArrowDown');
      await settle();
      const focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.getAttribute('data-column')).toBe('name');
      expect(viewport().getAttribute('tabindex')).toBe('-1');
    });

    it('moves focus with the arrow keys', async () => {
      const cell = await enterGrid();
      pressKey(cell, 'ArrowRight');
      await settle();
      let focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.getAttribute('data-column')).toBe('city');

      // Scoped to gridcells: the header row carries its own roving tab stop,
      // so a bare `[tabindex="0"]` matches the header first.
      pressKey(
        viewport().querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]') ?? cell,
        'ArrowDown',
      );
      await settle();
      focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.closest('[role="row"]')?.getAttribute('data-key')).toBe('2');
      expect(focused?.getAttribute('data-column')).toBe('city');
    });

    it('jumps within the row with Home and End', async () => {
      const cell = await enterGrid();
      pressKey(cell, 'End');
      await settle();
      let focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.getAttribute('data-column')).toBe('score');

      pressKey(focused as HTMLElement, 'Home');
      await settle();
      focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.getAttribute('data-column')).toBe('name');
    });

    it('jumps to the last cell of the dataset with Ctrl+End and scrolls it into view', async () => {
      const cell = await enterGrid();
      pressKey(cell, 'End', { ctrlKey: true });
      await settle();
      const focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.closest('[role="row"]')?.getAttribute('data-key')).toBe('1000');
      expect(focused?.getAttribute('data-column')).toBe('score');
      expect(renderedKeys()).toContain('1000');
    });

    it('moves a page of rows with PageDown', async () => {
      const cell = await enterGrid();
      pressKey(cell, 'PageDown');
      await settle();
      const focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      // 400px viewport over 40px rows is a 10-row page.
      expect(focused?.closest('[role="row"]')?.getAttribute('data-key')).toBe('11');
    });

    it('ignores keys typed inside a renderer’s own content', async () => {
      fixture.componentInstance.withCellTemplate.set(true);
      await settle();
      const cell = await enterGrid();
      const custom = rows()[0].querySelector<HTMLElement>('.custom-cell');
      if (custom == null) {
        throw new Error('cell template not rendered');
      }
      pressKey(custom, 'ArrowRight');
      await settle();
      const focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.getAttribute('data-column')).toBe('name');
      void cell;
    });
  });

  describe('focus durability', () => {
    it('keeps the focused row rendered after it scrolls out of the window', async () => {
      const cell = cellsOf(rows()[0])[0];
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      await scrollTo(8000);
      expect(renderedKeys()).toContain('1');
      const focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.closest('[role="row"]')?.getAttribute('data-key')).toBe('1');
    });

    it('keeps focus on the same key when the data reloads', async () => {
      const cell = cellsOf(rows()[1])[0];
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      fixture.componentInstance.data.set(makeRows(500));
      await settle();
      const focused = viewport().querySelector('[role="gridcell"][tabindex="0"]');
      expect(focused?.closest('[role="row"]')?.getAttribute('data-key')).toBe('2');
    });

    it('drops focus when its row disappears and nothing takes its place', async () => {
      const cell = cellsOf(rows()[0])[0];
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      fixture.componentInstance.data.set([]);
      await settle();
      expect(viewport().querySelectorAll('[role="gridcell"][tabindex="0"]').length).toBe(0);
    });
  });

  describe('states', () => {
    it('renders the empty state when there is no data at all', async () => {
      fixture.componentInstance.data.set([]);
      await settle();
      const host = grid();
      const state = host.querySelector('[data-state="empty"]');
      expect(state).not.toBeNull();
      expect(host.querySelector('[data-state="no-results"]')).toBeNull();
    });

    it('distinguishes no results for the current filter from no data', async () => {
      fixture.componentInstance.filter.set({ field: 'name', op: 'eq', value: 'nothing matches' });
      await settle();
      const host = grid();
      expect(host.querySelector('[data-state="no-results"]')).not.toBeNull();
      expect(host.querySelector('[data-state="empty"]')).toBeNull();
    });

    it('renders the error state with a retry affordance and recovers', async () => {
      let shouldFail = true;
      const source: GridDataSource<Row> = {
        load: (): Promise<QueryResult<Row>> =>
          shouldFail
            ? Promise.reject(new Error('network down'))
            : Promise.resolve({ rows: makeRows(3), totalCount: 3 }),
      };
      fixture.componentInstance.data.set(source);
      await settle();

      const host = grid();
      const state = host.querySelector('[data-state="error"]');
      if (state == null) {
        throw new Error('error state not rendered');
      }
      expect(state.textContent).toContain('network down');
      expect(host.getAttribute('data-error')).toBe('');

      shouldFail = false;
      const retry = state.querySelector('button');
      if (retry == null) {
        throw new Error('retry affordance not rendered');
      }
      retry.click();
      await settle();
      expect(host.querySelector('[data-state="error"]')).toBeNull();
      expect(renderedKeys()).toEqual(['1', '2', '3']);
    });

    it('announces through a polite live region', () => {
      const live = grid().querySelector('[role="status"]');
      expect(live?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('host contract', () => {
    it('exposes appearance and state as data attributes', async () => {
      const host = grid();
      expect(host.getAttribute('data-density')).toBe('standard');
      expect(host.getAttribute('data-striped')).toBeNull();
      expect(host.getAttribute('data-hover')).toBe('');
      expect(host.getAttribute('data-row-separators')).toBe('');

      fixture.componentInstance.striped.set(true);
      fixture.componentInstance.density.set('compact');
      await settle();
      expect(host.getAttribute('data-striped')).toBe('');
      expect(host.getAttribute('data-density')).toBe('compact');
    });

    it('publishes its geometry as custom properties', () => {
      const host = grid();
      expect(host.style.getPropertyValue('--dg-row-height')).toBe('40px');
      expect(host.style.getPropertyValue('--dg-total-width')).toBe('450px');
      expect(host.style.getPropertyValue('--dg-template')).toBe('200px 150px 100px');
    });

    it('names the grid from the consumer', () => {
      expect(viewport().getAttribute('aria-label')).toBe('Bookings');
    });
  });
});

describe('Datagrid copy', () => {
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
  });

  it('reads the keys the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({
          'datagrid.empty.title': 'customer.emptyTitle',
          'datagrid.announce.filtersCleared': 'customer.filtersCleared',
        }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.data.set([]);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(
      { customer: { emptyTitle: 'Nothing here yet', filtersCleared: 'All filters gone' } },
      'en',
      { merge: true },
    );
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('datagrid/en'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-state="empty"] .dg-state-title')?.textContent.trim()).toBe(
      'Nothing here yet',
    );

    // An announcement reads its key in TypeScript, not through the pipe.
    const grid = fixture.debugElement.query(By.directive(Datagrid)).componentInstance as Datagrid;
    grid.clearAllFilters();
    fixture.detectChanges();
    expect(host.querySelector('.dg-live')?.textContent.trim()).toBe('All filters gone');
  });
});
