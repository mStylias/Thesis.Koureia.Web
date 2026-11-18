/**
 * §5.1 column groups and the primary column, through the rendered grid.
 *
 * jsdom lays nothing out, so the spans are asserted on `aria-colspan` and on
 * the grid placement the header writes, not on pixels. What a browser has to
 * confirm is that those placements land where the columns are.
 */
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Datagrid } from './datagrid';
import { DatagridColumnChooser } from './column-chooser/datagrid-column-chooser';
import type { ColumnDef } from './core/types/column.types';
import type { GridKey } from './core/types/key.types';

interface Booking {
  id: number;
  code: string;
  name: string;
  phone: string;
  city: string;
  total: number;
}

const ROWS: Booking[] = [
  { id: 1, code: 'BK-1', name: 'Ada', phone: '111', city: 'Nicosia', total: 30 },
  { id: 2, code: 'BK-2', name: 'Grace', phone: '222', city: 'Limassol', total: 45 },
];

/** `Code | [Customer: Name, [Contact: Phone]] | [Address: City] | Total`. */
const BANDED: ColumnDef<Booking>[] = [
  { id: 'code', field: 'code', caption: 'Code', width: 100 },
  {
    id: 'customer',
    caption: 'Customer',
    columns: [
      { id: 'name', field: 'name', caption: 'Name', width: 120 },
      {
        id: 'contact',
        caption: 'Contact',
        columns: [{ id: 'phone', field: 'phone', caption: 'Phone', width: 120 }],
      },
    ],
  },
  {
    id: 'address',
    caption: 'Address',
    columns: [{ id: 'city', field: 'city', caption: 'City', width: 120 }],
  },
  { id: 'total', field: 'total', caption: 'Total', width: 100 },
];

let viewportHeight = 400;
let viewportWidth = 900;

@Component({
  selector: 'lib-bands-host',
  imports: [Datagrid, DatagridColumnChooser],
  template: `
    <lib-datagrid
      [columns]="columns()"
      [data]="data()"
      [key]="'id'"
      [rowHeight]="40"
      [(hiddenColumns)]="hidden"
      (primaryCellActivated)="activated.set($event.key)"
      (rowActivated)="rowActivated.set($event.key)"
    />
    <lib-datagrid-column-chooser [columns]="columns()" [(hidden)]="hidden" />
  `,
})
class BandsHost {
  readonly columns = signal<readonly ColumnDef<Booking>[]>(BANDED);
  readonly data = signal<readonly Booking[]>(ROWS);
  readonly hidden = signal<readonly string[]>([]);
  readonly activated = signal<GridKey | null>(null);
  readonly rowActivated = signal<GridKey | null>(null);
}

describe('Datagrid column groups and primary column', () => {
  let fixture: ComponentFixture<BandsHost>;
  let host: BandsHost;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function headerRows(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('lib-datagrid-header [role="row"]')];
  }

  function headerCell(id: string): HTMLElement {
    const found = root().querySelector<HTMLElement>(
      `lib-datagrid-header [role="columnheader"][data-column="${id}"]`,
    );
    if (found == null) {
      throw new Error(`header ${id} not rendered`);
    }
    return found;
  }

  /**
   * The columns left to right. Sorted by `aria-colindex` rather than taken in
   * document order: a banded header writes each cell in the row it starts in,
   * so a column with no band above it comes before one that has two.
   */
  function columnOrder(): string[] {
    return [
      ...root().querySelectorAll<HTMLElement>(
        'lib-datagrid-header [role="columnheader"]:not([data-band])',
      ),
    ]
      .sort(
        (a, b) => Number(a.getAttribute('aria-colindex')) - Number(b.getAttribute('aria-colindex')),
      )
      .map((cell) => cell.getAttribute('data-column') ?? '');
  }

  /** Opens the chooser popover, whose list lives in a deferred template. */
  async function openChooser(): Promise<void> {
    root().querySelector<HTMLElement>('lib-datagrid-column-chooser button')?.click();
    await settle();
  }

  function press(element: HTMLElement, init: KeyboardEventInit): void {
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
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
    fixture = TestBed.createComponent(BandsHost);
    host = fixture.componentInstance;
    await settle();
  });

  describe('banded header', () => {
    it('draws one row per nesting level plus the column row', () => {
      expect(headerRows()).toHaveLength(3);
    });

    it('indexes the header rows from the top of the grid', () => {
      expect(headerRows().map((row) => row.getAttribute('aria-rowindex'))).toEqual(['1', '2', '3']);
    });

    it('spans a band over the columns it covers', () => {
      expect(headerCell('customer').getAttribute('aria-colspan')).toBe('2');
      expect(headerCell('customer').getAttribute('aria-colindex')).toBe('2');
    });

    it('reaches an unbanded column down through every band row', () => {
      expect(headerCell('code').getAttribute('aria-rowspan')).toBe('3');
      expect(headerCell('code').style.gridRow).toBe('1 / span 3');
    });

    it('leaves the deepest column with no rowspan to declare', () => {
      expect(headerCell('phone').getAttribute('aria-rowspan')).toBe(null);
    });

    it('places a band over the same tracks its columns occupy', () => {
      expect(headerCell('customer').style.gridColumn).toBe('2 / span 2');
      expect(headerCell('name').style.gridColumn).toBe('2');
      expect(headerCell('phone').style.gridColumn).toBe('3');
    });

    it('narrows a band when one of its columns is hidden', async () => {
      host.hidden.set(['phone']);
      await settle();
      expect(headerCell('customer').getAttribute('aria-colspan')).toBe('1');
    });

    it('drops a band whose every column is hidden', async () => {
      host.hidden.set(['city']);
      await settle();
      expect(root().querySelector('lib-datagrid-header [data-column="address"]')).toBe(null);
    });

    it('counts the header rows into the body row indices', () => {
      const first = root().querySelector<HTMLElement>('[role="row"][data-key="1"]');
      expect(first?.getAttribute('aria-rowindex')).toBe('4');
    });

    it('reports the header rows to the styles, so the filter row sticks under them', () => {
      const grid = root().querySelector<HTMLElement>('lib-datagrid');
      expect(grid?.style.getPropertyValue('--dg-header-rows')).toBe('3');
    });

    it('renders no band row at all for an unbanded grid', async () => {
      host.columns.set([{ id: 'code', field: 'code', caption: 'Code' }]);
      await settle();
      expect(headerRows()).toHaveLength(1);
      expect(root().querySelector('[data-band]')).toBe(null);
    });
  });

  describe('reordering inside a band', () => {
    it('moves a column past its sibling', async () => {
      press(headerCell('name'), { key: 'ArrowRight', ctrlKey: true, shiftKey: true });
      await settle();
      expect(columnOrder()).toEqual(['code', 'phone', 'name', 'city', 'total']);
    });

    it('refuses to carry a column out of its band', async () => {
      // `name` is the first column of Customer; there is no sibling to its
      // left, so the press has nowhere inside the band to go.
      press(headerCell('name'), { key: 'ArrowLeft', ctrlKey: true, shiftKey: true });
      await settle();
      expect(columnOrder()).toEqual(['code', 'name', 'phone', 'city', 'total']);
    });

    it('moves a whole band when the band itself is moved', async () => {
      press(headerCell('customer'), { key: 'ArrowLeft', ctrlKey: true, shiftKey: true });
      await settle();
      expect(columnOrder()).toEqual(['name', 'phone', 'code', 'city', 'total']);
    });

    it('keeps a nested band together when its parent moves', async () => {
      press(headerCell('customer'), { key: 'ArrowRight', ctrlKey: true, shiftKey: true });
      await settle();
      expect(columnOrder()).toEqual(['code', 'city', 'name', 'phone', 'total']);
      expect(headerCell('contact').getAttribute('aria-colindex')).toBe('4');
    });
  });

  describe('header navigation', () => {
    it('walks up from a column to the band that names it', async () => {
      headerCell('phone').focus();
      press(headerCell('phone'), { key: 'ArrowUp' });
      await settle();
      expect(document.activeElement?.getAttribute('data-column')).toBe('contact');
    });

    it('walks down from a band to the first column under it', async () => {
      headerCell('customer').focus();
      press(headerCell('customer'), { key: 'ArrowDown' });
      await settle();
      expect(document.activeElement?.getAttribute('data-column')).toBe('name');
    });

    it('walks along a band row rather than into the columns below', async () => {
      headerCell('customer').focus();
      press(headerCell('customer'), { key: 'ArrowRight' });
      await settle();
      expect(document.activeElement?.getAttribute('data-column')).toBe('address');
    });
  });

  describe('column chooser', () => {
    /** The popover portals to the body, so the panel is queried from there. */
    function panel(): HTMLElement {
      const found = document.querySelector<HTMLElement>('.dg-chooser');
      if (found == null) {
        throw new Error('chooser panel not opened');
      }
      return found;
    }

    it('lists the columns under their band captions', async () => {
      await openChooser();
      const list = panel().querySelectorAll<HTMLElement>('.dg-chooser-list > li');
      expect([...list].map((item) => item.textContent.trim())).toEqual([
        'Code',
        'Customer',
        'Name',
        'Contact',
        'Phone',
        'Address',
        'City',
        'Total',
      ]);
    });

    it('offers no checkbox on a band, which has no visibility of its own', async () => {
      await openChooser();
      expect(panel().querySelector('.dg-chooser-band lib-checkbox')).toBe(null);
    });

    it('counts the columns, not the bands', () => {
      expect(root().querySelector('.dg-chooser-count')?.textContent).toBe('(5/5)');
    });
  });

  describe('primary column', () => {
    beforeEach(async () => {
      host.columns.set([
        { id: 'code', field: 'code', caption: 'Code', primary: true, width: 120 },
        { id: 'name', field: 'name', caption: 'Name', width: 120 },
      ]);
      await settle();
    });

    function primaryButton(): HTMLElement {
      const found = root().querySelector<HTMLElement>(
        '[role="row"][data-key="1"] [data-primary-activate]',
      );
      if (found == null) {
        throw new Error('primary control not rendered');
      }
      return found;
    }

    it('renders the identifier as a real control, out of the tab order', () => {
      expect(primaryButton().tagName).toBe('BUTTON');
      expect(primaryButton().getAttribute('tabindex')).toBe('-1');
      expect(primaryButton().textContent.trim()).toBe('BK-1');
    });

    it('renders a link when the column supplies one', async () => {
      host.columns.set([
        {
          id: 'code',
          field: 'code',
          caption: 'Code',
          primary: { href: (row: Booking): string => `/bookings/${row.id.toString()}` },
          width: 120,
        },
      ]);
      await settle();
      expect(primaryButton().tagName).toBe('A');
      expect(primaryButton().getAttribute('href')).toBe('/bookings/1');
    });

    it('pins the column and refuses to hide it', async () => {
      expect(headerCell('code').getAttribute('data-pinned')).toBe('start');
      host.hidden.set(['code']);
      await settle();
      expect(columnOrder()).toContain('code');
    });

    it('emits on a click, and does not activate the row as well', () => {
      primaryButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(host.activated()).toBe(1);
      expect(host.rowActivated()).toBe(null);
    });

    /** Focus follows the press, which is what tells the grid which cell it is. */
    function focusCell(columnId: string): HTMLElement {
      const found = root().querySelector<HTMLElement>(
        `[role="row"][data-key="1"] [data-column="${columnId}"]`,
      );
      if (found == null) {
        throw new Error(`cell ${columnId} not rendered`);
      }
      found.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      fixture.detectChanges();
      return found;
    }

    it('emits on Enter over the cell, in one press', () => {
      press(focusCell('code'), { key: 'Enter' });
      expect(host.activated()).toBe(1);
      expect(host.rowActivated()).toBe(null);
      expect(document.activeElement).not.toBe(primaryButton());
    });

    it('leaves an ordinary cell activating its row', () => {
      press(focusCell('name'), { key: 'Enter' });
      expect(host.rowActivated()).toBe(1);
      expect(host.activated()).toBe(null);
    });
  });
});
