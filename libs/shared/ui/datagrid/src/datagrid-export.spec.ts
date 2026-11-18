/**
 * §15 through the shell: the toolbar affordance, the capability and column
 * gates, `beforeExport`, the events, the full-dataset fetch with its progress
 * and cancellation, the clipboard shortcut and the file saver seam.
 *
 * The saver is replaced in every test that produces a file, so nothing here
 * touches a download — which is also the seam a host uses to upload instead.
 */
import { Component, computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { Datagrid } from './datagrid';
import {
  provideDatagridExcel,
  provideDatagridExport,
  provideDatagridFileSaver,
  provideDatagridPdf,
} from './core/export/export-adapters';
import type { ColumnDef } from './core/types/column.types';
import type {
  ExportConfig,
  GridCapabilities,
  GridConfig,
  SummaryConfig,
  ToolbarConfig,
} from './core/types/config.types';
import type { GridEvent } from './core/types/event.types';
import type { GridDataSource, Query, QueryResult } from './core/types/query.types';

interface Row {
  id: number;
  name: string;
  branch: string;
  total: number;
}

const ROWS: Row[] = [
  { id: 1, name: 'Alpha', branch: 'Nicosia', total: 10 },
  { id: 2, name: 'Beta', branch: 'Larnaca', total: 20 },
  { id: 3, name: 'Gamma', branch: 'Nicosia', total: 30 },
];

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', width: 200 },
  { id: 'branch', field: 'branch', caption: 'Branch', width: 200 },
  { id: 'total', field: 'total', caption: 'Total', width: 120, dataType: 'number' },
];

/** A remote source with more rows than one page, so paging is exercised. */
function remoteSource(count: number, onLoad?: (query: Query) => void): GridDataSource<Row> {
  const all = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Row ${(index + 1).toString()}`,
    branch: index % 2 === 0 ? 'Nicosia' : 'Larnaca',
    total: index,
  }));
  return {
    load: async (query: Query): Promise<QueryResult<Row>> => {
      onLoad?.(query);
      const skip = query.skip ?? 0;
      const take = query.take ?? all.length;
      await Promise.resolve();
      return { rows: all.slice(skip, skip + take), totalCount: all.length };
    },
  };
}

let viewportHeight = 400;
let viewportWidth = 900;

@Component({
  selector: 'lib-export-page',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [config]="config()"
      [rowHeight]="40"
      [toolbar]="toolbar()"
      [capabilities]="capabilities()"
      [summaries]="summaries()"
      [selectionMode]="'multiple'"
      [(group)]="group"
      (gridEvent)="events.push($event)"
    />
  `,
})
class Page {
  readonly columns = signal<readonly ColumnDef<Row>[]>(COLUMNS);
  readonly data = signal<readonly Row[] | GridDataSource<Row>>(ROWS);
  readonly toolbar = signal<ToolbarConfig | null>(null);
  readonly exportConfig = signal<ExportConfig | undefined>(undefined);
  readonly capabilities = signal<GridCapabilities | null>(null);
  readonly summaries = signal<readonly SummaryConfig[]>([]);
  readonly group = signal<readonly { field: string }[]>([]);
  readonly events: GridEvent<Row>[] = [];

  /** Everything structural arrives as one config value, as a real host does. */
  readonly config = computed<GridConfig<Row>>(() => {
    const exported = this.exportConfig();
    return {
      key: 'id',
      columns: this.columns(),
      data: this.data(),
      ...(exported === undefined ? {} : { export: exported }),
    };
  });
}

describe('Datagrid export, clipboard and print', () => {
  let fixture: ComponentFixture<Page>;
  let page: Page;
  let saved: { blob: Blob; fileName: string }[];
  let copied: string[];

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function grid(): Datagrid<Row> {
    const found = fixture.debugElement.children[0]?.componentInstance as Datagrid<Row> | undefined;
    if (found == null) {
      throw new Error('grid not rendered');
    }
    return found;
  }

  function toolbarItems(): string[] {
    return [...host().querySelectorAll<HTMLElement>('[data-toolbar-item]')].map(
      (element) => element.dataset['toolbarItem'] ?? '',
    );
  }

  function eventsNamed(name: string): GridEvent<Row>[] {
    return page.events.filter((event) => event.name === name);
  }

  async function textOfSaved(index = 0): Promise<string> {
    const bytes = new Uint8Array(await saved[index].blob.arrayBuffer());
    // The CSV adapter writes a byte-order mark, which the assertions here do
    // not care about.
    return new TextDecoder().decode(bytes).replace(/^\uFEFF/, '');
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
    saved = [];
    copied = [];
    // jsdom has no clipboard at all, so the write path needs one to reach.
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string): Promise<void> => {
          copied.push(text);
          return Promise.resolve();
        },
      },
    });
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
        provideDatagridExcel(),
        provideDatagridPdf(),
        provideDatagridFileSaver((blob, fileName) => {
          saved.push({ blob, fileName });
        }),
      ],
    });
    fixture = TestBed.createComponent(Page);
    page = fixture.componentInstance;
    await settle();
  });

  describe('the toolbar affordance', () => {
    it('draws one button when a single format is offered', async () => {
      page.toolbar.set({ items: ['export'] });
      await settle();
      expect(toolbarItems()).toEqual(['export']);
      const button = host().querySelector<HTMLButtonElement>('[data-toolbar-item="export"] button');
      expect(button?.getAttribute('aria-haspopup')).toBeNull();
    });

    it('becomes a menu once more than one format is offered', async () => {
      page.exportConfig.set({ formats: ['csv', 'xlsx'] });
      page.toolbar.set({ items: ['export'] });
      await settle();
      const button = host().querySelector<HTMLButtonElement>('[data-toolbar-item="export"] button');
      expect(button?.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('withholds the item outright when the capability is withheld', async () => {
      page.capabilities.set({ exporting: false });
      page.toolbar.set({ items: ['export', 'refresh'] });
      await settle();
      expect(toolbarItems()).toEqual(['refresh']);
    });

    it('withholds the item when export is disabled by config', async () => {
      page.exportConfig.set({ enabled: false });
      page.toolbar.set({ items: ['export', 'refresh'] });
      await settle();
      expect(toolbarItems()).toEqual(['refresh']);
    });
  });

  describe('the table model', () => {
    it('writes the visible columns in order, with their captions', async () => {
      await grid().exportGrid('csv');
      await settle();
      expect((await textOfSaved()).split('\r\n')[0]).toBe('Name,Branch,Total');
    });

    it('leaves out a column that refuses exporting', async () => {
      page.columns.set([COLUMNS[0], { ...COLUMNS[1], allow: { exporting: false } }, COLUMNS[2]]);
      await settle();
      await grid().exportGrid('csv');
      expect((await textOfSaved()).split('\r\n')[0]).toBe('Name,Total');
    });

    it('follows the column order and the hidden set the user arranged', async () => {
      grid().api().moveColumn('total', 0);
      grid().api().setColumnVisible('branch', false);
      await settle();
      await grid().exportGrid('csv');
      expect((await textOfSaved()).split('\r\n')[0]).toBe('Total,Name');
    });

    it('honors the current filter and sort rather than the loaded order', async () => {
      grid()
        .api()
        .setSort([{ field: 'name', desc: true }]);
      await settle();
      await grid().exportGrid('csv');
      const lines = (await textOfSaved()).split('\r\n');
      expect(lines.slice(1)).toEqual(['Gamma,Nicosia,30', 'Beta,Larnaca,20', 'Alpha,Nicosia,10']);
    });

    it('writes group rows and a total that covers the whole export', async () => {
      page.group.set([{ field: 'branch' }]);
      page.summaries.set([{ field: 'total', type: 'sum' }]);
      await settle();
      await grid().exportGrid('csv');
      const text = await textOfSaved();
      expect(text).toContain('Branch: Larnaca (1)');
      expect(text).toContain('Branch: Nicosia (2)');
      expect(text.split('\r\n').at(-1)).toBe('Totals,,60');
    });
  });

  describe('beforeExport', () => {
    it('lets a handler splice a row into the model before anything is written', async () => {
      fixture.componentInstance.events.length = 0;
      const sub = grid().gridEvent.subscribe((event) => {
        if (event.name === 'beforeExport') {
          event.payload.model.rows.unshift({
            kind: 'custom',
            level: 0,
            key: null,
            cells: [
              {
                value: 'Report',
                text: 'Report',
                type: 'string',
                colSpan: 3,
                indent: 0,
                style: null,
              },
            ],
          });
        }
      });
      await grid().exportGrid('csv');
      sub.unsubscribe();
      expect((await textOfSaved()).split('\r\n')[0]).toBe('Report,,');
    });

    it('lets a handler rename the file', async () => {
      const sub = grid().gridEvent.subscribe((event) => {
        if (event.name === 'beforeExport') {
          event.payload.fileName = 'renamed';
        }
      });
      await grid().exportGrid('csv');
      sub.unsubscribe();
      expect(saved[0].fileName).toBe('renamed.csv');
    });

    it('vetoes the run synchronously, and nothing is saved', async () => {
      const sub = grid().gridEvent.subscribe((event) => {
        if (event.name === 'beforeExport') {
          event.payload.canceled = true;
        }
      });
      await grid().exportGrid('csv');
      sub.unsubscribe();
      expect(saved).toHaveLength(0);
      expect(eventsNamed('exportCanceled')).toHaveLength(1);
      expect(eventsNamed('exported')).toHaveLength(0);
    });
  });

  describe('events and outcomes', () => {
    it('reports the finished file and how many rows it holds', async () => {
      await grid().exportGrid('csv');
      const [event] = eventsNamed('exported');
      expect(event.payload).toEqual({ format: 'csv', fileName: 'export.csv', rowCount: 3 });
    });

    it('takes the file name from the config', async () => {
      page.exportConfig.set({ fileName: 'bookings' });
      await settle();
      await grid().exportGrid('csv');
      expect(saved[0].fileName).toBe('bookings.csv');
    });

    it('reports a format nothing writes rather than failing silently', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await grid().exportGrid('ods');
      warn.mockRestore();
      expect(saved).toHaveLength(0);
      expect(eventsNamed('exportFailed')).toHaveLength(1);
    });

    it('writes a spreadsheet once provideDatagridExcel is registered', async () => {
      await grid().exportGrid('xlsx');
      expect(saved[0].fileName).toBe('export.xlsx');
      expect(saved[0].blob.type).toContain('spreadsheetml');
    });

    it('writes a PDF of every row, not the loaded page, once provideDatagridPdf is registered', async () => {
      page.data.set(remoteSource(250));
      page.exportConfig.set({ pageSize: 100 });
      await settle();
      // No fonts are registered here, which warns in development.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await grid().exportGrid('pdf');
      warn.mockRestore();
      expect(saved[0].fileName).toBe('export.pdf');
      expect(saved[0].blob.type).toBe('application/pdf');
      expect(eventsNamed('exported')[0].payload).toMatchObject({ format: 'pdf', rowCount: 250 });
    });

    it('refuses the API call when the capability is withheld', async () => {
      page.capabilities.set({ exporting: false });
      await settle();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await grid().api().export('csv');
      warn.mockRestore();
      expect(saved).toHaveLength(0);
    });
  });

  describe('the full-dataset fetch', () => {
    it('exports beyond the loaded page, and reports progress as it pages', async () => {
      page.data.set(remoteSource(250));
      page.exportConfig.set({ pageSize: 100 });
      await settle();
      await grid().exportGrid('csv');
      expect(eventsNamed('exported')[0].payload).toMatchObject({ rowCount: 250 });
      const progress = eventsNamed('exportProgress').map((event) => event.payload);
      expect(progress).toEqual([
        { loaded: 100, total: 250 },
        { loaded: 200, total: 250 },
        { loaded: 250, total: 250 },
      ]);
    });

    it('shows a progress strip with a cancel control while it runs', async () => {
      page.data.set(remoteSource(250));
      page.exportConfig.set({ pageSize: 100 });
      await settle();
      const running = grid().exportGrid('csv');
      await settle();
      const bar = host().querySelector('.dg-export-bar');
      expect(bar).not.toBeNull();
      expect(bar?.querySelector('[role="progressbar"]')).not.toBeNull();
      expect(bar?.querySelector('button')).not.toBeNull();
      await running;
      await settle();
      expect(host().querySelector('.dg-export-bar')).toBeNull();
    });

    it('cancels from the strip, and writes no file', async () => {
      page.data.set(remoteSource(500));
      page.exportConfig.set({ pageSize: 50 });
      await settle();
      const running = grid().exportGrid('csv');
      await settle();
      host().querySelector<HTMLButtonElement>('.dg-export-bar button')?.click();
      await running;
      await settle();
      expect(saved).toHaveLength(0);
      expect(eventsNamed('exportCanceled')).toHaveLength(1);
    });

    it('exports only the loaded rows when the scope says so', async () => {
      const queries: Query[] = [];
      page.data.set(remoteSource(250, (query) => queries.push(query)));
      page.exportConfig.set({ scope: 'page' });
      await settle();
      const before = queries.length;
      await grid().exportGrid('csv');
      expect(queries).toHaveLength(before);
      expect(eventsNamed('exported')[0].payload).toMatchObject({
        rowCount: grid().api().getRows().length,
      });
    });

    it('exports only the selected rows when the scope says so', async () => {
      grid().api().setSelectedKeys([1, 3]);
      await settle();
      await grid().exportGrid('csv', { scope: 'selected' });
      expect((await textOfSaved()).split('\r\n').slice(1)).toEqual([
        'Alpha,Nicosia,10',
        'Gamma,Nicosia,30',
      ]);
    });
  });

  describe('clipboard', () => {
    it('copies the selected rows as tab-separated text', async () => {
      grid().api().setSelectedKeys([2]);
      await settle();
      await grid().api().copyToClipboard();
      expect(copied).toEqual(['Name\tBranch\tTotal\nBeta\tLarnaca\t20']);
    });

    it('falls back to the focused row when nothing is selected', async () => {
      grid().api().focusCell(3, 'name');
      await settle();
      await grid().api().copyToClipboard();
      expect(copied[0]).toContain('Gamma');
    });

    it('copies on Ctrl+C over a cell', async () => {
      grid().api().setSelectedKeys([1]);
      await settle();
      const cell = host().querySelector<HTMLElement>('[role="gridcell"]');
      cell?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }),
      );
      // The handler builds the model behind a dynamic import, so the copy
      // lands a few microtasks after the key rather than within the same tick.
      await vi.waitFor(() => {
        expect(copied).toHaveLength(1);
      });
      expect(copied[0]).toContain('Alpha');
    });

    it('leaves the shortcut to the browser when the grid has nothing to give', async () => {
      const cell = host().querySelector<HTMLElement>('[role="gridcell"]');
      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      cell?.dispatchEvent(event);
      await settle();
      expect(event.defaultPrevented).toBe(false);
      expect(copied).toHaveLength(0);
    });
  });

  describe('host adapters', () => {
    it('lets a registration replace the built-in csv writer', async () => {
      TestBed.resetTestingModule();
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
          provideDatagridExport({
            format: 'csv',
            extension: 'txt',
            mimeType: 'text/plain',
            write: (model) => new Blob([`rows:${model.rows.length.toString()}`]),
          }),
          provideDatagridFileSaver((blob, fileName) => {
            saved.push({ blob, fileName });
          }),
        ],
      });
      fixture = TestBed.createComponent(Page);
      page = fixture.componentInstance;
      await settle();
      await grid().exportGrid('csv');
      expect(saved[0].fileName).toBe('export.txt');
      expect(await saved[0].blob.text()).toBe('rows:4');
    });
  });
});
