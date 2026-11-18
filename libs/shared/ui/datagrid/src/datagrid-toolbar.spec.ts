/**
 * §13 toolbar, §6.1 slot map, §6.2 cell presets and §5.3 lookups.
 *
 * Everything here reaches the grid as a value on a binding: that is the whole
 * point of the milestone, so the host is a plain page with no projection at
 * all.
 */
import { Component, input, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { Datagrid } from './datagrid';
import { filterBuilder, filterRow } from './features';
import { actionsColumn, booleanColumn, linkColumn, tagColumn } from './presets/columns';
import type { ColumnDef } from './core/types/column.types';
import type {
  BuiltInToolbarItem,
  GridCapabilities,
  ToolbarConfig,
} from './core/types/config.types';
import type { GridTemplates } from './core/types/template.types';
import type { SortSpec } from './core/types/query.types';
import type { DatagridFeature } from './features.types';

interface Row {
  id: number;
  name: string;
  status: string;
  active: boolean;
  branchId: number;
}

const ROWS: Row[] = [
  { id: 1, name: 'Alpha', status: 'open', active: true, branchId: 1 },
  { id: 2, name: 'Beta', status: 'closed', active: false, branchId: 2 },
];

const BRANCHES = [
  { code: 1, label: 'Nicosia' },
  { code: 2, label: 'Larnaca' },
];

/** A promise a test resolves by hand, so a load can be held open. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return {
    promise,
    resolve: () => {
      resolve();
    },
  };
}

let viewportHeight = 400;
let viewportWidth = 900;
/**
 * Width every toolbar item reports. Zero — jsdom's own answer — leaves the bar
 * measuring nothing and collapsing nothing, which is what every test but the
 * overflow one wants.
 */
let toolbarItemWidth = 0;

/** A renderer as a component type — the form that crosses a wrapper. */
@Component({ selector: 'lib-no-rows', template: `<p class="no-rows">Nothing here</p>` })
class NoRows {}

@Component({
  selector: 'lib-toolbar-page',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      [key]="'id'"
      [rowHeight]="40"
      [toolbar]="toolbar()"
      [templates]="templates()"
      [features]="features()"
      [capabilities]="capabilities()"
      [selectionMode]="'multiple'"
      [view]="view()"
      [(sort)]="sort"
      [(search)]="search"
    />
  `,
})
class Page {
  readonly columns = signal<readonly ColumnDef<Row>[]>([
    { id: 'name', field: 'name', caption: 'Name', width: 200 },
  ]);
  readonly data = signal<readonly Row[]>(ROWS);
  readonly toolbar = signal<ToolbarConfig | null>(null);
  readonly templates = signal<GridTemplates | null>(null);
  readonly features = signal<readonly DatagridFeature[]>([]);
  readonly capabilities = signal<GridCapabilities | null>(null);
  readonly view = signal<'table' | 'cards' | 'auto'>('table');
  readonly sort = signal<readonly SortSpec[]>([]);
  readonly search = signal<string | null>(null);
}

describe('Datagrid toolbar, templates, presets and lookups', () => {
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

  function items(): string[] {
    return [...host().querySelectorAll<HTMLElement>('[data-toolbar-item]')].map(
      (element) => element.dataset['toolbarItem'] ?? '',
    );
  }

  /** A menu entry is a checkbox item when it carries a state, plain when not. */
  function menuEntries(): HTMLElement[] {
    return [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]'),
    ];
  }

  /**
   * Waits for the expression editor to land. It arrives by dynamic import and
   * then waits out a macrotask, so it is two hops away from the press.
   */
  async function reachBuilder(): Promise<void> {
    for (let pass = 0; pass < 40; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
      if (document.querySelector('lib-datagrid-filter-builder') != null) {
        return;
      }
    }
  }

  function menuLabels(): string[] {
    return menuEntries().map((entry) => entry.textContent.trim());
  }

  function cellOf(key: string, columnId: string): HTMLElement {
    const found = host().querySelector<HTMLElement>(
      `[role="row"][data-key="${key}"] [data-column="${columnId}"]`,
    );
    if (found == null) {
      throw new Error(`cell ${columnId} of row ${key} not rendered`);
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
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement): number {
        return this.hasAttribute('data-toolbar-item') ? toolbarItemWidth : 0;
      },
    });
  });

  beforeEach(async () => {
    viewportHeight = 400;
    viewportWidth = 900;
    toolbarItemWidth = 0;
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

  describe('composition', () => {
    it('draws no bar until something asks for one', () => {
      expect(host().querySelector('.dg-toolbar')).toBeNull();
    });

    it('draws built-in items by name', async () => {
      page.toolbar.set({ items: ['search', 'columnChooser', 'refresh'] });
      await settle();
      expect(items()).toEqual(['search', 'columnChooser', 'refresh']);
    });

    it('draws a host item and runs its handler', async () => {
      const clicked = signal(0);
      page.toolbar.set({
        items: [
          {
            id: 'new',
            label: 'New',
            onClick: (): void => {
              clicked.update((count) => count + 1);
            },
          },
        ],
      });
      await settle();
      const button = host().querySelector<HTMLButtonElement>('[data-toolbar-item="new"] button');
      button?.click();
      expect(clicked()).toBe(1);
    });

    it('gates an item on the host visibility predicate', async () => {
      const allowed = signal(false);
      page.toolbar.set({ items: [{ id: 'new', label: 'New', visible: () => allowed() }] });
      await settle();
      expect(items()).toEqual([]);
      allowed.set(true);
      await settle();
      expect(items()).toEqual(['new']);
    });

    it('orders by `order` and keeps declaration order within one value', async () => {
      page.toolbar.set({
        items: [
          { id: 'c', label: 'C' },
          { id: 'a', label: 'A', order: -1 },
          { id: 'b', label: 'B' },
        ],
      });
      await settle();
      expect(items()).toEqual(['a', 'c', 'b']);
    });

    it('places items in the region they name', async () => {
      page.toolbar.set({
        items: [
          { id: 'end', label: 'End', location: 'end' },
          { id: 'start', label: 'Start' },
        ],
      });
      await settle();
      const idsIn = (region: string): (string | undefined)[] => {
        const found = host().querySelector<HTMLElement>(
          `.dg-toolbar-region[data-region="${region}"]`,
        );
        return [...(found?.querySelectorAll<HTMLElement>('[data-toolbar-item]') ?? [])].map(
          (item) => item.dataset['toolbarItem'],
        );
      };
      expect(idsIn('start')).toEqual(['start']);
      expect(idsIn('end')).toEqual(['end']);
    });

    it('hides the whole bar on request', async () => {
      page.toolbar.set({ visible: false, items: ['refresh'] });
      await settle();
      expect(host().querySelector('.dg-toolbar')).toBeNull();
    });

    it('draws nothing for a name that is not a built-in at all, and says so', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      page.toolbar.set({ items: ['nonsense' as BuiltInToolbarItem, 'refresh'] });
      await settle();
      expect(items()).toEqual(['refresh']);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('nonsense'));
      warn.mockRestore();
    });

    it('withholds an item whose capability the mask refuses', async () => {
      page.capabilities.set({ hiding: false });
      page.toolbar.set({ items: ['columnChooser', 'refresh'] });
      await settle();
      expect(items()).toEqual(['refresh']);
    });

    it('drives the grid search from the built-in field', async () => {
      page.toolbar.set({ items: ['search'] });
      await settle();
      const input = host().querySelector<HTMLInputElement>('[data-toolbar-item="search"] input');
      if (input == null) {
        throw new Error('search field not rendered');
      }
      input.value = 'alp';
      input.dispatchEvent(new Event('input'));
      await settle();
      expect(page.search()).toBe('alp');
    });

    it('toggles the filter row from its own item', async () => {
      page.features.set([filterRow()]);
      page.toolbar.set({ items: ['filterToggle'] });
      await settle();
      expect(host().querySelector('lib-datagrid-filter-row')).not.toBeNull();
      host().querySelector<HTMLButtonElement>('[data-toolbar-item="filterToggle"] button')?.click();
      await settle();
      expect(host().querySelector('lib-datagrid-filter-row')).toBeNull();
    });

    it('reports the selection count on the clear item, and disables it when empty', async () => {
      page.toolbar.set({ items: ['clearSelection'] });
      await settle();
      const button = (): HTMLButtonElement | null =>
        host().querySelector('[data-toolbar-item="clearSelection"] button');
      expect(button()?.disabled).toBe(true);
      cellOf('1', 'name').click();
      await settle();
      expect(button()?.disabled).toBe(false);
      expect(button()?.querySelector('.dg-toolbar-badge')?.textContent.trim()).toBe('1');
    });
  });

  describe('sorting and the presentation switch', () => {
    it('withholds the sort menu in the table, where the header sorts', async () => {
      page.toolbar.set({ items: ['sortMenu'] });
      await settle();

      expect(items()).toEqual([]);
    });

    it('offers one entry per sortable column, and none to clear while unsorted', async () => {
      page.view.set('cards');
      page.toolbar.set({ items: ['sortMenu'] });
      await settle();
      const trigger = host().querySelector<HTMLButtonElement>(
        '[data-toolbar-item="sortMenu"] button',
      );
      trigger?.click();
      await settle();

      expect(menuLabels()).toEqual(['Name']);
    });

    it('advances one column through ascending, descending and unsorted', async () => {
      page.view.set('cards');
      page.toolbar.set({ items: ['sortMenu'] });
      await settle();
      const open = async (): Promise<HTMLElement> => {
        host().querySelector<HTMLButtonElement>('[data-toolbar-item="sortMenu"] button')?.click();
        await settle();
        const entries = menuEntries();
        if (entries.length === 0) {
          throw new Error('sort entry not rendered');
        }
        return entries[0];
      };
      // Read from the sort model rather than a header cell: there is no header
      // in the presentation this item exists for.
      (await open()).click();
      await settle();
      expect(page.sort()).toEqual([{ field: 'name' }]);

      (await open()).click();
      await settle();
      expect(page.sort()).toEqual([{ field: 'name', desc: true }]);

      (await open()).click();
      await settle();
      expect(page.sort()).toEqual([]);
    });

    it('withholds the sort menu when the grid refuses sorting', async () => {
      page.view.set('cards');
      page.capabilities.set({ sorting: false });
      page.toolbar.set({ items: ['sortMenu'] });
      await settle();

      expect(items()).toEqual([]);
    });

    it('switches the presentation, and only when the host asks for the item', async () => {
      page.toolbar.set({ items: ['refresh'] });
      await settle();
      expect(items()).toEqual(['refresh']);

      page.toolbar.set({ items: ['viewSwitch'] });
      await settle();
      host().querySelector<HTMLButtonElement>('[data-toolbar-item="viewSwitch"] button')?.click();
      await settle();

      expect(host().querySelectorAll('[data-card]').length).toBe(ROWS.length);
      expect(host().querySelector('[role="grid"]')).toBeNull();
    });
  });

  describe('the filter builder item', () => {
    beforeEach(async () => {
      page.features.set([filterBuilder()]);
      await settle();
    });

    it('carries the trigger in a bar of its own while nothing else does', () => {
      expect(host().querySelector('.dg-filter-builder-bar')).not.toBeNull();
    });

    it('drops that bar once the toolbar carries the trigger', async () => {
      page.toolbar.set({ items: ['filterBuilder'] });
      await settle();

      expect(items()).toEqual(['filterBuilder']);
      expect(host().querySelector('.dg-filter-builder-bar')).toBeNull();
    });

    it('opens the editor from the button', async () => {
      page.toolbar.set({ items: ['filterBuilder'] });
      await settle();
      host()
        .querySelector<HTMLButtonElement>('[data-toolbar-item="filterBuilder"] button')
        ?.click();
      await reachBuilder();

      expect(document.querySelector('lib-datagrid-filter-builder')).not.toBeNull();
    });

    it('opens the editor from the overflow surface too', async () => {
      // Where the item actually lives on a narrow screen, which is the screen
      // that asked for a button instead of a bar.
      toolbarItemWidth = 200;
      viewportWidth = 320;
      page.toolbar.set({ items: ['refresh', 'resetArrangement', 'filterBuilder'] });
      await settle();
      host().querySelector<HTMLButtonElement>('.dg-toolbar > button')?.click();
      await settle();
      const inSurface = document.querySelector<HTMLButtonElement>(
        '.dg-toolbar-overflow [data-toolbar-item="filterBuilder"] button',
      );
      expect(inSurface).not.toBeNull();
      inSurface?.click();
      await reachBuilder();

      expect(document.querySelector('lib-datagrid-filter-builder')).not.toBeNull();
    });

    it('resolves to nothing when the grid offers no editor', async () => {
      page.features.set([]);
      page.toolbar.set({ items: ['filterBuilder'] });
      await settle();

      expect(items()).toEqual([]);
    });
  });

  describe('the overflow surface', () => {
    /** Opens the surface and returns the buttons inside it. */
    async function overflowButtons(): Promise<HTMLButtonElement[]> {
      host().querySelector<HTMLButtonElement>('.dg-toolbar > button')?.click();
      await settle();
      return [...document.querySelectorAll<HTMLButtonElement>('.dg-toolbar-overflow button')];
    }

    beforeEach(async () => {
      // Wide items in a narrow bar, so the trailing entries collapse.
      toolbarItemWidth = 200;
      viewportWidth = 320;
      page.toolbar.set({
        iconOnly: true,
        items: ['refresh', 'resetArrangement', 'clearSelection'],
      });
      await settle();
    });

    it('collapses what does not fit', () => {
      expect(host().querySelector('.dg-toolbar > button')).not.toBeNull();
      expect(items().length).toBeLessThan(3);
    });

    // The caption is also what keeps the button the shape of a row: a
    // stretched icon-only button takes `libButton`'s `aspect-ratio: 1` and
    // draws a block as tall as the panel is wide. jsdom applies no
    // stylesheet, so only the caption itself is assertable here.
    it('draws a caption on every collapsed entry, whatever the bar-wide icon-only rule says', async () => {
      const buttons = await overflowButtons();

      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.textContent.trim()).not.toBe('');
      }
    });
  });

  describe('the templates slot map', () => {
    it('fills a state slot with a component type', async () => {
      page.data.set([]);
      page.templates.set({ empty: NoRows });
      await settle();
      expect(host().querySelector('.no-rows')?.textContent).toBe('Nothing here');
    });

    it('fills a cell slot by column id', async () => {
      page.templates.set({ cell: { name: NameCell } });
      await settle();
      expect(cellOf('1', 'name').querySelector('.mapped-cell')?.textContent).toBe('Alpha');
    });

    it('loses to the reference on the definition only where no map entry exists', async () => {
      page.columns.set([{ id: 'name', field: 'name', width: 200, cell: DefinitionCell }]);
      await settle();
      expect(cellOf('1', 'name').querySelector('.definition-cell')).not.toBeNull();
      page.templates.set({ cell: { name: NameCell } });
      await settle();
      expect(cellOf('1', 'name').querySelector('.mapped-cell')).not.toBeNull();
    });
  });

  describe('cell presets', () => {
    it('draws a tag with the tone its value maps to', async () => {
      page.columns.set([
        tagColumn<Row>(
          { id: 'status', field: 'status', width: 160 },
          { tone: { open: 'success', closed: 'neutral' } },
        ),
      ]);
      await settle();
      const tag = cellOf('1', 'status').querySelector<HTMLElement>('.dg-tag');
      expect(tag?.textContent.trim()).toBe('open');
      expect(tag?.dataset['tone']).toBe('success');
    });

    it('falls back to a neutral tone for a value the map omits', async () => {
      page.columns.set([tagColumn<Row>({ id: 'status', field: 'status', width: 160 }, {})]);
      await settle();
      expect(cellOf('2', 'status').querySelector<HTMLElement>('.dg-tag')?.dataset['tone']).toBe(
        'neutral',
      );
    });

    it('renders a real anchor, so modifier-click keeps working', async () => {
      page.columns.set([
        linkColumn<Row>(
          { id: 'name', field: 'name', width: 200 },
          { href: (row) => `/r/${row.id}` },
        ),
      ]);
      await settle();
      const link = cellOf('1', 'name').querySelector<HTMLAnchorElement>('a.dg-link');
      expect(link?.getAttribute('href')).toBe('/r/1');
      expect(link?.textContent.trim()).toBe('Alpha');
    });

    it('keeps a boolean glyph readable as text, not as a shape alone', async () => {
      page.columns.set([
        booleanColumn<Row>({ id: 'active', field: 'active', width: 120 }, { display: 'check' }),
      ]);
      await settle();
      expect(cellOf('1', 'active').querySelector('.dg-boolean-text')?.textContent.trim()).toBe(
        'Yes',
      );
      expect(cellOf('2', 'active').querySelector('.dg-boolean-text')?.textContent.trim()).toBe(
        'No',
      );
    });

    it('runs a row action with the row and its key', async () => {
      const seen = signal<[string, unknown] | null>(null);
      page.columns.set([
        { id: 'name', field: 'name', width: 200 },
        actionsColumn<Row>(
          { id: 'actions' },
          {
            actions: [
              {
                id: 'edit',
                label: 'Edit',
                run: (row, key): void => {
                  seen.set([row.name, key]);
                },
              },
            ],
          },
        ),
      ]);
      await settle();
      cellOf('2', 'actions').querySelector<HTMLButtonElement>('button')?.click();
      expect(seen()).toEqual(['Beta', 2]);
    });

    it('hides an action the row refuses and disables one it cannot run', async () => {
      page.columns.set([
        actionsColumn<Row>(
          { id: 'actions', width: 200 },
          {
            maxInline: 5,
            actions: [
              { id: 'edit', label: 'Edit', run: () => undefined },
              {
                id: 'close',
                label: 'Close',
                visible: (row) => row.status === 'open',
                run: () => undefined,
              },
              { id: 'del', label: 'Delete', disabled: () => true, run: () => undefined },
            ],
          },
        ),
      ]);
      await settle();
      const openRow = [...cellOf('1', 'actions').querySelectorAll<HTMLButtonElement>('button')];
      const closedRow = [...cellOf('2', 'actions').querySelectorAll<HTMLButtonElement>('button')];
      expect(openRow).toHaveLength(3);
      expect(closedRow).toHaveLength(2);
      expect(openRow[2].disabled).toBe(true);
    });

    it('keeps action buttons out of the tab order, which the body owns', async () => {
      page.columns.set([
        actionsColumn<Row>(
          { id: 'actions' },
          { actions: [{ id: 'edit', label: 'Edit', run: () => undefined }] },
        ),
      ]);
      await settle();
      const button = cellOf('1', 'actions').querySelector<HTMLButtonElement>('button');
      expect(button?.getAttribute('tabindex')).toBe('-1');
    });

    it('does not select the row when an action is pressed', async () => {
      page.columns.set([
        { id: 'name', field: 'name', width: 200 },
        actionsColumn<Row>(
          { id: 'actions' },
          { actions: [{ id: 'edit', label: 'Edit', run: () => undefined }] },
        ),
      ]);
      await settle();
      cellOf('1', 'actions').querySelector<HTMLButtonElement>('button')?.click();
      await settle();
      expect(host().querySelector('[role="row"][data-selected]')).toBeNull();
    });
  });

  describe('entering a cell that holds controls', () => {
    beforeEach(async () => {
      page.columns.set([
        { id: 'name', field: 'name', width: 200 },
        actionsColumn<Row>(
          { id: 'actions' },
          { actions: [{ id: 'edit', label: 'Edit', run: () => undefined }] },
        ),
      ]);
      await settle();
    });

    it('moves focus into the first control on Enter', async () => {
      const cell = cellOf('1', 'actions');
      // A press is what puts the roving tabindex on the cell, which is where
      // the grid reads the focused cell from.
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await settle();
      expect(document.activeElement?.tagName).toBe('BUTTON');
    });

    it('returns focus to the cell on Escape', async () => {
      const cell = cellOf('1', 'actions');
      const button = cell.querySelector<HTMLButtonElement>('button');
      button?.focus();
      button?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(document.activeElement).toBe(cell);
    });

    it('still activates the row from a cell that holds nothing', async () => {
      const cell = cellOf('1', 'name');
      cell.focus();
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await settle();
      expect(document.activeElement).toBe(cell);
    });
  });

  describe('lookups', () => {
    it('renders the display value of a stored code', async () => {
      page.columns.set([
        {
          id: 'branch',
          field: 'branchId',
          width: 200,
          lookup: { source: BRANCHES, value: 'code', display: 'label' },
        },
      ]);
      await settle();
      expect(cellOf('1', 'branch').textContent.trim()).toBe('Nicosia');
      expect(cellOf('2', 'branch').textContent.trim()).toBe('Larnaca');
    });

    it('shows the stored value when the collection does not cover it', async () => {
      page.columns.set([
        {
          id: 'branch',
          field: 'branchId',
          width: 200,
          lookup: { source: [{ code: 9, label: 'Elsewhere' }], value: 'code', display: 'label' },
        },
      ]);
      await settle();
      expect(cellOf('1', 'branch').textContent.trim()).toBe('1');
    });

    it('redraws cells rendered before an asynchronous collection arrived', async () => {
      const gate = deferred();
      page.columns.set([
        {
          id: 'branch',
          field: 'branchId',
          width: 200,
          lookup: {
            source: {
              load: async () => {
                await gate.promise;
                return { rows: BRANCHES };
              },
            },
            value: 'code',
            display: 'label',
          },
        },
      ]);
      await settle();
      expect(cellOf('1', 'branch').textContent.trim()).toBe('1');
      gate.resolve();
      // The load resolves through three awaits before the store is written,
      // and one settle drains fewer microtask turns than that.
      await settle();
      await settle();
      expect(cellOf('1', 'branch').textContent.trim()).toBe('Nicosia');
    });
  });
});

/** Slot-map renderers, declared apart so the map carries a plain symbol. */
@Component({ selector: 'lib-mapped-cell', template: `<i class="mapped-cell">{{ text() }}</i>` })
class NameCell {
  readonly context = input.required<{ displayValue: unknown }>();
  protected readonly text = (): string => String(this.context().displayValue);
}

@Component({ selector: 'lib-definition-cell', template: `<i class="definition-cell">def</i>` })
class DefinitionCell {
  readonly context = input.required<unknown>();
}
