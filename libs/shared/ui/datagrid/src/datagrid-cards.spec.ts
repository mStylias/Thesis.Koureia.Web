/**
 * The card presentation (§5.4).
 *
 * What is asserted here is what the table cannot be trusted to cover: that one
 * column set drives both shapes, that no table ARIA survives the switch, and
 * that the keyboard model is a list's rather than a grid's.
 */
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LucidePlus } from '@lucide/angular';
import { describe, expect, it, beforeEach } from 'vitest';
import { Datagrid } from './datagrid';
import type { ColumnDef } from './core/types/column.types';
import type { DatagridView } from './core/types/card.types';
import type { ToolbarConfig } from './core/types/config.types';
import type { GridKey } from './core/types/key.types';

interface Row {
  id: number;
  name: string;
  city: string;
  visits: number;
}

const ROWS: Row[] = [
  { id: 1, name: 'Anna', city: 'Nicosia', visits: 3 },
  { id: 2, name: 'Basil', city: 'Limassol', visits: 7 },
  { id: 3, name: 'Chris', city: 'Larnaca', visits: 1 },
];

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', primary: true },
  { id: 'city', field: 'city', caption: 'City' },
  { id: 'visits', field: 'visits', caption: 'Visits', dataType: 'number' },
];

@Component({
  selector: 'lib-datagrid-cards-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      key="id"
      ariaLabel="Rows"
      [columns]="columns()"
      [data]="rows"
      [view]="view()"
      [selectionMode]="selectionMode()"
      [group]="group()"
      [toolbar]="toolbar()"
      (rowActivated)="activated.set($event.key)"
      (primaryCellActivated)="primaryActivated.set($event.key)"
      (selectedKeysChange)="selected.set($event)"
    />
  `,
})
class Host {
  readonly columns = signal<readonly ColumnDef<Row>[]>(COLUMNS);
  readonly rows = ROWS;
  readonly view = signal<DatagridView>('cards');
  readonly selectionMode = signal<'none' | 'single' | 'multiple'>('none');
  readonly group = signal<readonly { field: string }[]>([]);
  readonly toolbar = signal<ToolbarConfig | null>(null);
  readonly activated = signal<GridKey | null>(null);
  readonly primaryActivated = signal<GridKey | null>(null);
  readonly selected = signal<readonly GridKey[]>([]);
}

/** Thirty rows, so a page of ten leaves two more to reach for. */
const PAGED_ROWS: Row[] = Array.from({ length: 30 }, (_, index) => ({
  id: index + 1,
  name: `Row ${(index + 1).toString()}`,
  city: 'Nicosia',
  visits: index,
}));

@Component({
  selector: 'lib-datagrid-cards-paged-host',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      key="id"
      ariaLabel="Rows"
      pagingMode="pager"
      [columns]="columns"
      [data]="rows"
      [view]="view()"
      [pageSize]="10"
      [pageSizes]="[10, 25]"
      [(pageIndex)]="pageIndex"
    />
  `,
})
class PagedHost {
  readonly columns = COLUMNS;
  readonly rows = PAGED_ROWS;
  readonly view = signal<DatagridView>('cards');
  readonly pageIndex = signal(0);
}

/**
 * Whether the stubbed viewport is below the card breakpoint.
 *
 * Read through a getter on every `matches` access rather than captured: CDK's
 * `MediaMatcher` is a root singleton that binds `window.matchMedia` the first
 * time anything injects it, and it caches one `MediaQueryList` per query — so a
 * value fixed at construction would answer for the whole file.
 */
let narrowViewport = false;

describe('the datagrid card view', () => {
  let fixture: ComponentFixture<Host>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function cards(): HTMLElement[] {
    return [...host().querySelectorAll<HTMLElement>('[data-card]')];
  }

  function cardAt(index: number): HTMLElement {
    const rendered = cards();
    if (index >= rendered.length) {
      throw new Error(`card ${index.toString()} not rendered`);
    }
    return rendered[index];
  }

  function textOf(card: HTMLElement, selector: string): string[] {
    return [...card.querySelectorAll(selector)].map((node) => node.textContent.trim());
  }

  function labelsOf(card: HTMLElement): string[] {
    return textOf(card, '.dg-card-label');
  }

  function valuesOf(card: HTMLElement): string[] {
    return textOf(card, '.dg-card-value');
  }

  /**
   * Loads the grid's dictionary, so an announcement built imperatively is
   * readable text rather than the empty string a missing scope returns.
   *
   * After a pipe has transformed, never before: `load()` only sees the scope's
   * loader as an inline one the `TranslocoPipe` supplies, and loading first
   * caches an empty translation under that key forever.
   */
  async function loadScope(): Promise<void> {
    await firstValueFrom(TestBed.inject(TranslocoService).load('datagrid/en'));
    await settle();
  }

  function liveRegion(): string {
    return (host().querySelector('.dg-live')?.textContent ?? '').trim();
  }

  function press(element: HTMLElement, key: string, init: KeyboardEventInit = {}): void {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  }

  beforeEach(async () => {
    narrowViewport = false;
    // jsdom has none, and CDK reports `matches: false` without one — so the
    // flip the auto tests describe would never happen, and they would pass
    // against a grid that had resolved nothing.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        media: query,
        get matches(): boolean {
          return narrowViewport;
        },
        onchange: null,
        addEventListener: (): void => undefined,
        removeEventListener: (): void => undefined,
        addListener: (): void => undefined,
        removeListener: (): void => undefined,
        dispatchEvent: (): boolean => false,
      }),
    });
    await TestBed.configureTestingModule({
      imports: [Host],
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
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  describe('the columns drive both shapes', () => {
    it('draws one card per row', () => {
      expect(cards()).toHaveLength(ROWS.length);
    });

    it('takes the title from the primary column and draws it without a caption', () => {
      const card = cardAt(0);

      expect(card.querySelector('.dg-card-title')?.textContent).toContain('Anna');
      expect(labelsOf(card)).toEqual(['City', 'Visits']);
    });

    it('labels each remaining column and pairs it with its value', () => {
      const card = cardAt(1);

      expect(labelsOf(card)).toEqual(['City', 'Visits']);
      expect(valuesOf(card)).toEqual(['Limassol', '7']);
    });

    it('draws a dash for a value that does not exist', async () => {
      fixture.componentInstance.columns.set([
        ...COLUMNS,
        { id: 'note', field: 'note', caption: 'Note' },
      ]);
      await settle();

      expect(valuesOf(cardAt(0))).toEqual(['Nicosia', '3', '—']);
    });

    it('keeps the caption of a field that draws without one, for screen readers', async () => {
      fixture.componentInstance.columns.set([
        { id: 'name', field: 'name', caption: 'Name', primary: true },
        { id: 'city', field: 'city', caption: 'City', card: { hideLabel: true } },
      ]);
      await settle();

      const label = cardAt(0).querySelector('.dg-card-label');
      if (label == null) {
        throw new Error('field label not rendered');
      }
      expect(label.textContent.trim()).toBe('City');
      expect(label.hasAttribute('data-clipped')).toBe(true);
    });

    it('drops a column the host left off the card', async () => {
      fixture.componentInstance.columns.set([
        { id: 'name', field: 'name', caption: 'Name', primary: true },
        { id: 'city', field: 'city', caption: 'City' },
        { id: 'visits', field: 'visits', caption: 'Visits', card: { role: 'none' } },
      ]);
      await settle();

      expect(labelsOf(cardAt(0))).toEqual(['City']);
    });

    it('formats a value exactly as the table cell would', () => {
      expect(valuesOf(cardAt(2))[1]).toBe('1');
    });
  });

  describe('accessibility', () => {
    it('is a list of list items, not a grid', () => {
      expect(host().querySelector('.dg-cards')?.getAttribute('role')).toBe('list');
      expect(cardAt(0).getAttribute('role')).toBe('listitem');
      expect(host().querySelector('[role="grid"]')).toBeNull();
      expect(host().querySelector('[role="gridcell"]')).toBeNull();
    });

    it('carries no table ARIA on the scroll container', () => {
      const viewport = host().querySelector('.dg-viewport');
      if (viewport == null) {
        throw new Error('viewport not rendered');
      }
      expect(viewport.getAttribute('role')).toBeNull();
      expect(viewport.getAttribute('aria-rowcount')).toBeNull();
      expect(viewport.getAttribute('aria-colcount')).toBeNull();
    });

    it('ties each value to its label with a description list', () => {
      const card = cardAt(0);

      expect(card.querySelector('dl')).not.toBeNull();
      expect(card.querySelectorAll('dt')).toHaveLength(2);
      expect(card.querySelectorAll('dd')).toHaveLength(2);
    });

    it('gives up the list role while grouped, where headings sit between cards', async () => {
      fixture.componentInstance.group.set([{ field: 'city' }]);
      await settle();

      expect(host().querySelector('.dg-cards')?.getAttribute('role')).toBeNull();
      expect(host().querySelectorAll('.dg-card-group').length).toBeGreaterThan(0);
    });
  });

  describe('the toolbar', () => {
    beforeEach(async () => {
      fixture.componentInstance.toolbar.set({
        items: [{ id: 'add', label: 'Add role', icon: LucidePlus, iconOnly: false }],
      });
      await settle();
    });

    it('draws every button as its icon alone, over an item asking to keep its caption', () => {
      const button = host().querySelector<HTMLButtonElement>('[data-toolbar-item="add"] button');
      if (button == null) {
        throw new Error('toolbar item not rendered');
      }

      expect(button.textContent.trim()).toBe('');
      expect(button.getAttribute('aria-label')).toBe('Add role');
    });

    it('leaves out an item that asks to be hidden in the cards, and draws it in the table', async () => {
      fixture.componentInstance.toolbar.set({
        items: [
          { id: 'add', label: 'Add role', icon: LucidePlus },
          { id: 'quick', label: 'Quick filter', icon: LucidePlus, hideInCards: true },
          { name: 'search', hideInCards: true },
        ],
      });
      await settle();

      expect(host().querySelector('[data-toolbar-item="quick"]')).toBeNull();
      expect(host().querySelector('[data-toolbar-item="search"]')).toBeNull();
      expect(host().querySelector('[data-toolbar-item="add"]')).not.toBeNull();

      fixture.componentInstance.view.set('table');
      await settle();

      expect(host().querySelector('[data-toolbar-item="quick"]')).not.toBeNull();
      expect(host().querySelector('[data-toolbar-item="search"]')).not.toBeNull();
    });

    it('gives the caption back in the table, where the bar has room', async () => {
      fixture.componentInstance.view.set('table');
      await settle();

      expect(host().querySelector('[data-toolbar-item="add"] button')?.textContent.trim()).toBe(
        'Add role',
      );
    });
  });

  describe('the presentation switch', () => {
    it('renders the table when the host asks for one', async () => {
      fixture.componentInstance.view.set('table');
      await settle();

      expect(host().querySelector('[role="grid"]')).not.toBeNull();
      expect(cards()).toHaveLength(0);
    });

    it('resolves auto to the table on the server and the first client frame', async () => {
      fixture.componentInstance.view.set('auto');
      await settle();

      expect(host().querySelector('[role="grid"]')).not.toBeNull();
    });

    it('reports a switch the user made', async () => {
      fixture.componentInstance.toolbar.set({ items: [{ name: 'viewSwitch' }] });
      await settle();
      host().querySelector<HTMLButtonElement>('[data-toolbar-item="viewSwitch"] button')?.click();
      await settle();

      await loadScope();

      expect(liveRegion()).toBe('Showing records as a table');
    });

    it('keeps the selection across the switch', async () => {
      fixture.componentInstance.selectionMode.set('multiple');
      await settle();
      cardAt(1).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      fixture.componentInstance.view.set('table');
      await settle();

      expect(fixture.componentInstance.selected()).toEqual([2]);
    });
  });

  describe('auto, on a viewport that is already narrow', () => {
    beforeEach(async () => {
      narrowViewport = true;
      fixture = TestBed.createComponent(Host);
      fixture.componentInstance.view.set('auto');
      await settle();
      // The flip is three hops deep: `afterNextRender` creates the effect, the
      // effect subscribes, and `BreakpointObserver.observe` debounces by 0
      // before it answers. Each needs its own pass.
      for (let pass = 0; pass < 3; pass += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await settle();
      }
    });

    it('resolves to cards after the first render, never during it', () => {
      expect(cards()).toHaveLength(ROWS.length);
    });

    it('says nothing about a presentation the reader never saw change', async () => {
      // The initial resolution is not a change: nothing moved under the
      // reader, and the grid's lazy dictionary has not arrived — so the
      // announcement resolves to nothing and the console reports the key as
      // missing. The scope is loaded here so a real announcement would be
      // visible, which is what tells the two apart.
      await loadScope();

      expect(liveRegion()).toBe('');
    });
  });

  /**
   * The card view pages by scrolling.
   *
   * A pager under a list of cards spends a row of the content on controls, and
   * on the screen that draws cards there is no row to spare — so `pager`
   * resolves to `infinite` here and the gesture the reader is already making is
   * the way to the next page.
   */
  describe('paging', () => {
    let paged: ComponentFixture<PagedHost>;

    async function settlePaged(): Promise<void> {
      paged.detectChanges();
      await paged.whenStable();
      paged.detectChanges();
    }

    function pagedHost(): HTMLElement {
      return paged.nativeElement as HTMLElement;
    }

    function pagedCards(): HTMLElement[] {
      return [...pagedHost().querySelectorAll<HTMLElement>('[data-card]')];
    }

    function titles(): string[] {
      return pagedCards().map(
        (card) => card.querySelector('.dg-card-title')?.textContent.trim() ?? '',
      );
    }

    function grid(): Datagrid<Row> {
      return paged.debugElement.children[0].componentInstance as Datagrid<Row>;
    }

    beforeEach(async () => {
      paged = TestBed.createComponent(PagedHost);
      await settlePaged();
    });

    it('draws neither the pager nor the page sizes', () => {
      expect(pagedHost().querySelector('.dg-pager-row')).toBeNull();
      expect(pagedHost().querySelector('lib-paginator')).toBeNull();
      expect(pagedHost().querySelector('.dg-page-sizes')).toBeNull();
      expect(pagedHost().querySelector('.dg-page-size')).toBeNull();
    });

    it('watches for the end of the list instead', () => {
      expect(pagedCards()).toHaveLength(10);
      expect(pagedHost().querySelector('.dg-load-sentinel')).not.toBeNull();
    });

    it('appends the next page rather than replacing it', async () => {
      grid().loadMore();
      await settlePaged();

      expect(pagedCards()).toHaveLength(20);
      expect(titles()[0]).toContain('Row 1');
      expect(titles()[19]).toContain('Row 20');
    });

    it('stops watching once there is nothing left to fetch', async () => {
      grid().loadMore();
      await settlePaged();
      grid().loadMore();
      await settlePaged();

      expect(pagedCards()).toHaveLength(30);
      expect(pagedHost().querySelector('.dg-load-sentinel')).toBeNull();
    });

    it('keeps the pager in the table, where the row it costs is affordable', async () => {
      paged.componentInstance.view.set('table');
      await settlePaged();

      expect(pagedHost().querySelector('lib-paginator')).not.toBeNull();
      expect(pagedHost().querySelector('.dg-page-sizes')).not.toBeNull();
      expect(pagedHost().querySelector('.dg-load-sentinel')).toBeNull();
    });

    // Going to cards on page three would otherwise accumulate from row 21 with
    // the first twenty unreachable, because there is no pager left to go back
    // with. Coming back the other way would stitch three pages under one.
    it('goes back to the first page when the presentation changes', async () => {
      paged.componentInstance.view.set('table');
      await settlePaged();
      paged.componentInstance.pageIndex.set(2);
      await settlePaged();
      expect(paged.componentInstance.pageIndex()).toBe(2);

      paged.componentInstance.view.set('cards');
      await settlePaged();

      expect(paged.componentInstance.pageIndex()).toBe(0);
      expect(titles()[0]).toContain('Row 1');
    });
  });

  describe('pointer', () => {
    // Regression: only the title opened the record, so a press anywhere else on the card did nothing.
    it('opens the record from a press anywhere on the card, which a phone has no second of', async () => {
      cardAt(0).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(fixture.componentInstance.primaryActivated()).toBe(1);
      expect(fixture.componentInstance.activated()).toBeNull();
    });

    it('activates the row from a card press when no column opens the record', async () => {
      fixture.componentInstance.columns.set(
        COLUMNS.map((column) => ({ ...column, primary: undefined })),
      );
      await settle();
      cardAt(0).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(fixture.componentInstance.activated()).toBe(1);
      expect(fixture.componentInstance.primaryActivated()).toBeNull();
    });

    it('reports the identifier alone when the title is pressed', async () => {
      const control = cardAt(0).querySelector<HTMLElement>('[data-primary-activate]');
      if (control == null) {
        throw new Error('primary control not rendered');
      }
      control.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(fixture.componentInstance.primaryActivated()).toBe(1);
      expect(fixture.componentInstance.activated()).toBeNull();
    });

    it('selects through the checkbox without activating the record', async () => {
      fixture.componentInstance.selectionMode.set('multiple');
      await settle();
      const box = cardAt(2).querySelector<HTMLElement>('[data-card-select]');
      if (box == null) {
        throw new Error('selection checkbox not rendered');
      }
      box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(fixture.componentInstance.selected()).toEqual([3]);
      expect(fixture.componentInstance.activated()).toBeNull();
    });
  });

  describe('keyboard', () => {
    it('holds one tab stop and moves it with the vertical arrows', async () => {
      cardAt(0).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      expect(cardAt(0).getAttribute('tabindex')).toBe('0');
      expect(cardAt(1).getAttribute('tabindex')).toBe('-1');

      press(cardAt(0), 'ArrowDown');
      await settle();

      expect(cardAt(1).getAttribute('tabindex')).toBe('0');
      expect(cardAt(0).getAttribute('tabindex')).toBe('-1');
    });

    it('activates on Enter rather than entering the card', async () => {
      cardAt(1).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      press(cardAt(1), 'Enter');
      await settle();

      expect(fixture.componentInstance.primaryActivated()).toBe(2);
    });

    it('selects on Space', async () => {
      fixture.componentInstance.selectionMode.set('multiple');
      await settle();
      cardAt(0).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      press(cardAt(0), ' ');
      await settle();

      expect(fixture.componentInstance.selected()).toEqual([1]);
    });

    it('saturates at the ends instead of wrapping', async () => {
      cardAt(0).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await settle();
      press(cardAt(0), 'ArrowUp');
      await settle();

      expect(cardAt(0).getAttribute('tabindex')).toBe('0');
    });
  });
});
