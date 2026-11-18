/**
 * The chooser as a floating panel, hosted by the grid's toolbar.
 *
 * The application chooses the surface through `DATAGRID_COLUMN_CHOOSER_OPTIONS`,
 * so every test here provides it with a signal the test can flip.
 */
import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { Datagrid } from '../datagrid';
import { DATAGRID_COLUMN_CHOOSER_OPTIONS } from './column-chooser-presentation';
import type { ColumnDef } from '../core/types/column.types';
import type { ToolbarConfig } from '../core/types/config.types';
import type { ColumnChooserPresentation } from './datagrid-column-chooser.types';

interface Row {
  id: number;
  name: string;
  city: string;
}

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name', width: 200 },
  { id: 'city', field: 'city', caption: 'City', width: 200 },
];

let viewportWidth = 900;
/** Zero collapses nothing. The overflow test widens the items until the chooser folds. */
let toolbarItemWidth = 0;

@Component({
  selector: 'lib-column-panel-page',
  imports: [Datagrid],
  template: `
    <lib-datagrid
      [columns]="columns"
      [data]="rows"
      [key]="'id'"
      [rowHeight]="40"
      [toolbar]="toolbar()"
      [(hiddenColumns)]="hidden"
    />
  `,
})
class Page {
  readonly columns = COLUMNS;
  readonly rows: Row[] = [{ id: 1, name: 'Alpha', city: 'Nicosia' }];
  readonly toolbar = signal<ToolbarConfig>({ items: ['columnChooser'] });
  readonly hidden = signal<readonly string[]>([]);
}

describe('Datagrid column panel', () => {
  let fixture: ComponentFixture<Page>;
  let presentation: WritableSignal<ColumnChooserPresentation>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function trigger(root: ParentNode = host()): HTMLButtonElement {
    const found = root.querySelector<HTMLButtonElement>('lib-datagrid-column-chooser button');
    if (found == null) throw new Error('chooser trigger not rendered');
    return found;
  }

  function panel(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.fp');
  }

  /** CDK closes a popover on the press and reopens it on the click unless both are sent. */
  function press(button: HTMLElement): void {
    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    button.click();
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
      get: (): number => 400,
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
    viewportWidth = 900;
    toolbarItemWidth = 0;
    presentation = signal<ColumnChooserPresentation>('panel');
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
        {
          provide: DATAGRID_COLUMN_CHOOSER_OPTIONS,
          useValue: { presentation, panelInsetTop: 'var(--shell-header-height)' },
        },
      ],
    });
    fixture = TestBed.createComponent(Page);
    await settle();
  });

  afterEach(() => {
    // The panel and any popover live in overlays, which outlive the fixture's DOM.
    fixture.destroy();
  });

  it('opens the chooser in a floating panel the trigger controls', async () => {
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().hasAttribute('aria-haspopup')).toBe(false);

    trigger().click();
    await settle();

    const opened = panel();
    expect(opened).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(opened?.id);
    expect(opened?.querySelector('.dg-chooser')?.getAttribute('data-presentation')).toBe('panel');
  });

  it('docks the panel under the toolbar, so the bar and its buttons stay in reach', async () => {
    const bar = host().querySelector<HTMLElement>('.dg-toolbar');
    if (bar == null) throw new Error('toolbar not rendered');
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 60,
      left: 0,
      top: 60,
      right: 900,
      bottom: 110,
      width: 900,
      height: 50,
      toJSON: () => ({}),
    });

    trigger().click();
    await settle();

    expect(panel()?.style.getPropertyValue('--fp-dock-top')).toBe('110px');
  });

  it('gives the panel the top inset the application asked for', async () => {
    trigger().click();
    await settle();

    const layer = document.querySelector<HTMLElement>('.fp-layer');
    expect(layer?.style.getPropertyValue('--floating-panel-inset-top')).toBe(
      'var(--shell-header-height)',
    );
  });

  it('hides a column from the panel while the grid stays usable', async () => {
    trigger().click();
    await settle();

    const city = [...(panel()?.querySelectorAll('lib-checkbox') ?? [])].find((box) =>
      box.textContent.includes('City'),
    );
    city?.querySelector('input')?.click();
    await settle();

    expect(fixture.componentInstance.hidden()).toEqual(['city']);
    expect(trigger().textContent).toContain('(1/2)');
    expect(panel()).not.toBeNull();
  });

  it('closes from the trigger it opened from', async () => {
    trigger().click();
    await settle();
    trigger().click();
    await settle();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('falls back to the popover, and closes the panel, when the application says so', async () => {
    trigger().click();
    await settle();

    presentation.set('popover');
    await settle();

    expect(panel()).toBeNull();
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('keeps the panel open after the overflow surface it was opened from closes', async () => {
    // Wide items in a narrow bar, so the chooser folds into the overflow surface. The bar
    // reads its width when it first renders, so the page starts again at the new size.
    fixture.destroy();
    toolbarItemWidth = 200;
    viewportWidth = 320;
    fixture = TestBed.createComponent(Page);
    fixture.componentInstance.toolbar.set({
      items: ['refresh', 'resetArrangement', 'columnChooser'],
    });
    await settle();
    const more = host().querySelector<HTMLButtonElement>('.dg-toolbar > button');
    if (more == null) throw new Error('overflow trigger not rendered');

    press(more);
    await settle();
    const surface = document.querySelector<HTMLElement>('.dg-toolbar-overflow');
    if (surface == null) throw new Error('overflow surface not opened');
    trigger(surface).click();
    await settle();

    press(more);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await settle();

    expect(document.querySelector('.dg-toolbar-overflow lib-datagrid-column-chooser')).toBeNull();
    expect(panel()).not.toBeNull();
  });
});
