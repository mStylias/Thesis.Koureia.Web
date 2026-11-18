/**
 * §24 composition tests: an application wrapper drives the grid through the
 * bounded binding set alone — values and a reference cell, no projection and
 * no delegated methods.
 *
 * The wrapper here is deliberately written the way a real one is: it owns a
 * template in its own view, merges it into the column definitions it was
 * handed, forwards the API in one line and the whole event stream in another.
 */
import {
  Component,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
  type TemplateRef,
  type WritableSignal,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { Datagrid } from './datagrid';
import type { CellPosition, GridApi } from './core/types/api.types';
import type { ColumnDef } from './core/types/column.types';
import type { CellContext, CellTemplateContext, HeaderContext } from './core/types/context.types';
import type { GridEvent } from './core/types/event.types';
import type { GridKey } from './core/types/key.types';

interface Row {
  id: number;
  name: string;
  score: number;
}

let viewportHeight = 400;
let viewportWidth = 900;

const ROWS: Row[] = [
  { id: 1, name: 'Alpha', score: 10 },
  { id: 2, name: 'Beta', score: 20 },
  { id: 3, name: 'Gamma', score: 30 },
];

/**
 * A cell renderer as a component type. This is the form that crosses a
 * wrapper: another module imports the symbol, where a template would belong
 * forever to the view that declared it.
 */
@Component({
  selector: 'lib-score-cell',
  template: `<b class="score-cell">{{ context().displayValue }}</b>`,
})
class ScoreCell {
  readonly context = input.required<CellContext<Row>>();
}

/** A header renderer as a component type. */
@Component({
  selector: 'lib-score-header',
  template: `<em class="score-header">{{ context().column.caption }}</em>`,
})
class ScoreHeader {
  readonly context = input.required<HeaderContext<Row>>();
}

/** The application wrapper. Everything it forwards is a value or a ref cell. */
@Component({
  selector: 'lib-app-grid',
  imports: [Datagrid],
  template: `
    <ng-template #nameCell let-cell>
      <span class="wrapped-cell">{{ cell.displayValue }}</span>
    </ng-template>
    <lib-datagrid
      [columns]="resolvedColumns()"
      [data]="data()"
      [key]="key()"
      [rowHeight]="40"
      [selectionMode]="'multiple'"
      [apiRef]="apiRef()"
      [(selectedKeys)]="selectedKeys"
      (gridEvent)="gridEvent.emit($event)"
    />
  `,
})
class AppGrid {
  readonly columns = input<readonly ColumnDef<Row>[]>([]);
  readonly data = input<readonly Row[]>([]);
  readonly key = input<string | null>(null);
  readonly apiRef = input<WritableSignal<GridApi<Row> | null> | null>(null);
  readonly selectedKeys = model<readonly GridKey[]>([]);
  readonly gridEvent = output<GridEvent<Row>>();

  private readonly grid = viewChild.required<Datagrid<Row>>(Datagrid);

  /** One line, and it does not grow when the API does. */
  readonly api = computed(() => this.grid().api());

  // Optional rather than required: a view query resolves after the view is
  // created, so the first pass renders the plain cell and the second picks up
  // the renderer. That is the same path a host takes when its columns arrive
  // late, and it must not remount the grid.
  private readonly nameCell = viewChild<TemplateRef<CellTemplateContext<Row>>>('nameCell');

  protected readonly resolvedColumns = computed<readonly ColumnDef<Row>[]>(() => {
    const template = this.nameCell();
    if (template == null) {
      return this.columns();
    }
    return this.columns().map((column) =>
      column.id === 'name' ? { ...column, cell: template } : column,
    );
  });
}

/** The page. It never sees the grid — only the wrapper. */
@Component({
  selector: 'lib-composition-page',
  imports: [AppGrid],
  template: `
    <lib-app-grid
      #wrapper
      [columns]="columns()"
      [data]="data()"
      [key]="key()"
      [apiRef]="apiRef"
      [(selectedKeys)]="selectedKeys"
      (gridEvent)="onGridEvent($event)"
    />
  `,
})
class Page {
  readonly columns = signal<readonly ColumnDef<Row>[]>([
    { id: 'name', field: 'name', caption: 'Name', width: 200 },
    {
      id: 'score',
      field: 'score',
      caption: 'Score',
      width: 100,
      cell: ScoreCell,
      header: ScoreHeader,
    },
  ]);
  readonly data = signal<readonly Row[]>(ROWS);
  readonly key = signal<string | null>('id');
  readonly selectedKeys = signal<readonly GridKey[]>([]);
  readonly apiRef = signal<GridApi<Row> | null>(null);

  readonly wrapper = viewChild.required(AppGrid);

  readonly seen = signal<GridEvent<Row>[]>([]);
  readonly vetoSelection = signal(false);

  onGridEvent(event: GridEvent<Row>): void {
    this.seen.update((all) => [...all, event]);
    if (event.name === 'selectionChanging' && this.vetoSelection()) {
      event.payload.canceled = true;
    }
  }

  names(name: GridEvent<Row>['name']): GridEvent<Row>[] {
    return this.seen().filter((event) => event.name === name);
  }
}

describe('Datagrid composition through a wrapper', () => {
  let fixture: ComponentFixture<Page>;
  let page: Page;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowOf(key: string): HTMLElement {
    const found = host().querySelector<HTMLElement>(`[role="row"][data-key="${key}"]`);
    if (found == null) {
      throw new Error(`row ${key} not rendered`);
    }
    return found;
  }

  function cellOf(row: HTMLElement, columnId: string): HTMLElement {
    const found = row.querySelector<HTMLElement>(`[data-column="${columnId}"]`);
    if (found == null) {
      throw new Error(`cell ${columnId} not rendered`);
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
    // jsdom implements no pointer capture. Stubbed so the drag path runs; the
    // retargeting capture causes in a browser is not reproducible here.
    HTMLElement.prototype.setPointerCapture = (): void => undefined;
    HTMLElement.prototype.releasePointerCapture = (): void => undefined;
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
    fixture = TestBed.createComponent(Page);
    page = fixture.componentInstance;
    await settle();
  });

  describe('renderers', () => {
    it('draws a template the wrapper declared in its own view', () => {
      expect(cellOf(rowOf('1'), 'name').querySelector('.wrapped-cell')?.textContent).toBe('Alpha');
    });

    it('draws a component type carried on ColumnDef.cell', () => {
      expect(cellOf(rowOf('2'), 'score').querySelector('.score-cell')?.textContent).toBe('20');
    });

    it('draws a component type carried on ColumnDef.header', () => {
      const header = host().querySelector<HTMLElement>(
        '[role="columnheader"][data-column="score"]',
      );
      expect(header?.querySelector('.score-header')?.textContent).toBe('Score');
    });

    it('hands the renderer the imperative API in its context', () => {
      const api = page.wrapper().api();
      expect(api.getRow(1)).toEqual(ROWS[0]);
    });
  });

  describe('imperative API', () => {
    it('reaches the page through one computed on the wrapper', () => {
      expect(page.wrapper().api().getRows()).toHaveLength(3);
    });

    it('reaches the page through the apiRef cell as well', () => {
      expect(page.apiRef()?.getSelectedKeys()).toEqual([]);
    });

    it('is the same object on both paths', () => {
      expect(page.apiRef()).toBe(page.wrapper().api());
    });

    it('drives selection from beyond the wrapper', async () => {
      page.wrapper().api().setSelectedKeys([1, 3]);
      await settle();
      expect(page.selectedKeys()).toEqual([1, 3]);
      expect(rowOf('1').getAttribute('data-selected')).toBe('');
    });

    it('drives focus from beyond the wrapper', async () => {
      page.wrapper().api().focusCell(2, 'score');
      await settle();
      const focused: CellPosition | null = page.wrapper().api().getFocusedCell();
      expect(focused).toEqual({ key: 2, columnId: 'score' });
    });

    it('throws for a method whose milestone has not shipped', () => {
      expect(() => {
        page.wrapper().api().startEdit(1);
      }).toThrow(/not implemented yet/);
    });

    it('clears the apiRef cell on destruction', () => {
      fixture.destroy();
      expect(page.apiRef()).toBeNull();
    });
  });

  describe('event stream', () => {
    it('carries a granular event to the page in one binding', async () => {
      cellOf(rowOf('1'), 'name').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(page.names('rowClick')).toHaveLength(1);
    });

    it('reports the initial state without emitting a change for it', () => {
      expect(page.names('sortChanged')).toHaveLength(0);
      expect(page.names('selectionChanged')).toHaveLength(0);
    });

    it('announces itself once the view exists', () => {
      expect(page.names('initialized')).toHaveLength(1);
    });

    it('lands a veto set beyond the wrapper', async () => {
      page.vetoSelection.set(true);
      cellOf(rowOf('2'), 'name').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(page.names('selectionChanging')).toHaveLength(1);
      expect(page.names('selectionChanged')).toHaveLength(0);
      expect(page.selectedKeys()).toEqual([]);
      expect(rowOf('2').getAttribute('data-selected')).toBeNull();
    });

    it('applies the change when the veto is not set', async () => {
      cellOf(rowOf('2'), 'name').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(page.names('selectionChanging')).toHaveLength(1);
      expect(page.names('selectionChanged')).toHaveLength(1);
      expect(page.selectedKeys()).toEqual([2]);
    });

    it('refuses an API-driven selection under the same veto', async () => {
      page.vetoSelection.set(true);
      page.wrapper().api().setSelectedKeys([1]);
      await settle();
      expect(page.selectedKeys()).toEqual([]);
    });

    it('reports a settled width once, not once per drag frame', async () => {
      const handle = host().querySelector<HTMLElement>(
        '[role="columnheader"][data-column="name"] .dg-resize-handle',
      );
      if (handle == null) {
        throw new Error('resize handle not rendered');
      }
      handle.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 0 }),
      );
      for (const x of [10, 20, 30]) {
        handle.dispatchEvent(
          new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: x }),
        );
      }
      handle.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 30 }),
      );
      await settle();

      const resized = page.names('columnResized');
      expect(resized).toHaveLength(1);
      expect(resized[0].payload).toEqual({ columnId: 'name', width: 230 });
    });
  });
});
