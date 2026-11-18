import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { DatagridColumnChooser } from './datagrid-column-chooser';
import { DATAGRID_COLUMN_CHOOSER_OPTIONS } from './column-chooser-presentation';
import type { ColumnDef } from '../core/types/column.types';
import type { ColumnChooserPresentation } from './datagrid-column-chooser.types';

interface Row {
  id: number;
  name: string;
  city: string;
  score: number;
}

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name' },
  { id: 'city', field: 'city', caption: 'City' },
  { id: 'score', field: 'score', caption: 'Score' },
  { id: 'total', caption: 'Total' },
];

@Component({
  selector: 'lib-chooser-host',
  imports: [DatagridColumnChooser],
  template: `<lib-datagrid-column-chooser
    [columns]="columns()"
    [(hidden)]="hidden"
    [iconOnly]="iconOnly()"
  />`,
})
class Host {
  readonly columns = signal<ColumnDef<Row>[]>(COLUMNS);
  readonly hidden = signal<readonly string[]>([]);
  readonly iconOnly = signal(false);
}

describe('DatagridColumnChooser', () => {
  let fixture: ComponentFixture<Host>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function trigger(): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'lib-datagrid-column-chooser button',
    );
    if (found == null) {
      throw new Error('chooser trigger not rendered');
    }
    return found;
  }

  function count(): string {
    const found = trigger().querySelector<HTMLElement>('.dg-chooser-count');
    if (found == null) {
      throw new Error('chooser count not rendered');
    }
    return found.textContent.trim();
  }

  function label(): HTMLElement {
    const found = trigger().querySelector<HTMLElement>('.dg-chooser-label');
    if (found == null) {
      throw new Error('chooser label not rendered');
    }
    return found;
  }

  /** The button's accessible name, which is its text content in both modes. */
  function accessibleName(element: HTMLElement): string {
    return element.textContent.replace(/\s+/g, ' ').trim();
  }

  function tooltip(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="tooltip"]');
  }

  /** Hovers the trigger past the tooltip's show delay. */
  async function hoverTrigger(): Promise<void> {
    trigger().dispatchEvent(new Event('mouseenter'));
    await new Promise((resolve) => setTimeout(resolve, 150));
    await settle();
  }

  beforeEach(async () => {
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

  afterEach(() => {
    // Disposes any tooltip or popover overlay, which outlive the fixture's DOM.
    fixture.destroy();
  });

  it('reports the visible columns out of the total', async () => {
    expect(count()).toBe('(4/4)');

    fixture.componentInstance.hidden.set(['city']);
    await settle();

    expect(count()).toBe('(3/4)');
  });

  it('seeds a column hidden by its own definition into the hidden list', async () => {
    fixture.componentInstance.columns.set([
      ...COLUMNS.slice(0, 3),
      { id: 'total', caption: 'Total', visible: false },
    ]);
    await settle();

    expect(count()).toBe('(3/4)');
    // The list is the whole of visibility, so the declared hide is in it —
    // which is what lets the chooser take it back out again.
    expect(fixture.componentInstance.hidden()).toEqual(['total']);
  });

  it('shows a column its definition hid, once it leaves the hidden list', async () => {
    fixture.componentInstance.columns.set([
      ...COLUMNS.slice(0, 3),
      { id: 'total', caption: 'Total', visible: false },
    ]);
    await settle();

    // What checking the entry does. The declaration is not consulted again,
    // so it cannot hold the column hidden against the list.
    fixture.componentInstance.hidden.set([]);
    await settle();

    expect(count()).toBe('(4/4)');
  });

  it('keeps the caption and the count in the name when the trigger is icon only', async () => {
    const name = accessibleName(trigger());

    fixture.componentInstance.iconOnly.set(true);
    await settle();

    // Clipped rather than removed, and no `aria-label` takes over: the button
    // reads the same in both modes.
    expect(label().classList).toContain('dg-chooser-label-clipped');
    expect(trigger().hasAttribute('aria-label')).toBe(false);
    expect(accessibleName(trigger())).toBe(name);
    expect(count()).toBe('(4/4)');
  });

  it('repeats the label in a tooltip only when the trigger is icon only', async () => {
    await hoverTrigger();

    expect(tooltip()).toBeNull();

    trigger().dispatchEvent(new Event('mouseleave'));
    fixture.componentInstance.iconOnly.set(true);
    await settle();

    await hoverTrigger();

    const surface = tooltip();
    if (surface == null) {
      throw new Error('tooltip not rendered');
    }
    expect(accessibleName(surface)).toBe(accessibleName(label()));
  });

  it('holds the count steady while the panel search narrows the list', async () => {
    trigger().click();
    await settle();

    const search = document.querySelector<HTMLInputElement>('.dg-chooser-search input');
    if (search == null) {
      throw new Error('chooser search not rendered');
    }
    search.value = 'Cit';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();

    // The list narrows, but the trigger sits outside the panel and must not
    // move while the user types in it.
    expect(document.querySelectorAll('.dg-chooser-list li')).toHaveLength(1);
    expect(count()).toBe('(4/4)');
  });
});

@Component({
  selector: 'lib-chooser-panel-host',
  imports: [DatagridColumnChooser],
  template: `<lib-datagrid-column-chooser
    [columns]="columns"
    [(hidden)]="hidden"
    [presentation]="presentation()"
  />`,
})
class PanelHost {
  readonly columns = COLUMNS;
  readonly hidden = signal<readonly string[]>([]);
  readonly presentation = signal<ColumnChooserPresentation | null>(null);
}

describe('DatagridColumnChooser outside a toolbar', () => {
  let fixture: ComponentFixture<PanelHost>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function trigger(): HTMLButtonElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'lib-datagrid-column-chooser button',
    );
    if (found == null) {
      throw new Error('chooser trigger not rendered');
    }
    return found;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        {
          provide: DATAGRID_COLUMN_CHOOSER_OPTIONS,
          useValue: { presentation: signal<ColumnChooserPresentation>('panel') },
        },
      ],
    });
    fixture = TestBed.createComponent(PanelHost);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('opens a panel of its own when no toolbar hosts one', async () => {
    trigger().click();
    await settle();

    const panel = document.querySelector<HTMLElement>('.fp');
    expect(panel?.id).toBe(trigger().getAttribute('aria-controls'));
    expect(panel?.querySelectorAll('.dg-chooser-list li')).toHaveLength(4);
  });

  it('lets one chooser keep the popover the application replaced', async () => {
    fixture.componentInstance.presentation.set('popover');
    await settle();

    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    trigger().click();
    await settle();

    expect(document.querySelector('.fp')).toBeNull();
    expect(document.querySelector('.dg-chooser')?.getAttribute('data-presentation')).toBe(
      'popover',
    );
  });
});
