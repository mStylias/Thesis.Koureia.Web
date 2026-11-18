import { Component, Directive, inject, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TRANSLOCO_SCOPE, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { Calendar, CalendarFilterActionsSlot, CalendarFiltersSlot } from './calendar';
import type { CalendarPanel, CalendarRange, CalendarSlot, CalendarView } from './calendar.types';
import { CALENDAR_TOOLBAR_BREAKPOINTS } from './core/toolbar-layout';

const MONDAY = '2026-09-21';

/** Records the translation scope a projected element resolves, which must be the host's. */
@Directive({ selector: '[libSpecScopeProbe]' })
class ScopeProbe {
  static readonly scopes: unknown[] = [];

  constructor() {
    ScopeProbe.scopes.push(inject(TRANSLOCO_SCOPE, { optional: true }));
  }
}

/** jsdom has no ResizeObserver. This one lets a test hand the calendar a width. */
class ResizeObserverStub {
  static readonly instances: ResizeObserverStub[] = [];
  readonly targets: Element[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(): void {
    // Nothing to release.
  }

  disconnect(): void {
    this.targets.length = 0;
  }

  static resize(target: Element, width: number): void {
    for (const observer of ResizeObserverStub.instances) {
      if (observer.targets.includes(target)) {
        const entry = { target, contentRect: { width, height: 600 } } as ResizeObserverEntry;
        observer.callback([entry], observer);
      }
    }
  }
}

@Component({
  imports: [Calendar, CalendarFiltersSlot, CalendarFilterActionsSlot, ScopeProbe],
  template: `
    <lib-calendar
      timezone="UTC"
      locale="en-GB"
      [filtersActive]="filtersActive()"
      [(view)]="view"
      [(anchor)]="anchor"
      [(panel)]="panel"
      (rangeChange)="ranges.push($event)"
      (slotCreate)="created.push($event)"
    >
      @if (withFilters()) {
        <div libCalendarFilters libSpecScopeProbe class="spec-filters">Filters body</div>
        <button libCalendarFilterActions type="button" class="spec-clear">Clear</button>
      }
    </lib-calendar>
  `,
})
class Host {
  readonly view = signal<CalendarView>('week');
  readonly anchor = signal(MONDAY);
  readonly panel = signal<CalendarPanel>(null);
  readonly filtersActive = signal(0);
  readonly withFilters = signal(true);
  readonly ranges: CalendarRange[] = [];
  readonly created: (CalendarSlot | null)[] = [];
}

// jsdom has no dialog methods; the side panel is a `<dialog>`.
beforeAll(() => {
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

describe('Calendar', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function calendar(): HTMLElement {
    const found = root().querySelector<HTMLElement>('lib-calendar');
    if (found === null) throw new Error('calendar not rendered');
    return found;
  }

  function button(name: string): HTMLButtonElement {
    const found = [
      ...root().querySelectorAll<HTMLButtonElement>('lib-calendar-toolbar button'),
    ].find((element) =>
      (element.getAttribute('aria-label') ?? element.textContent).trim().startsWith(name),
    );
    if (found === undefined) throw new Error(`button ${name} not rendered`);
    return found;
  }

  function fab(name: string): HTMLButtonElement | null {
    return root().querySelector<HTMLButtonElement>(
      `lib-calendar-floating-actions button[aria-label="${name}"]`,
    );
  }

  function hasButton(name: string): boolean {
    try {
      button(name);
      return true;
    } catch {
      return false;
    }
  }

  async function resize(width: number): Promise<void> {
    ResizeObserverStub.resize(calendar(), width);
    await settle();
  }

  beforeEach(async () => {
    ResizeObserverStub.instances.length = 0;
    globalThis.ResizeObserver = ResizeObserverStub;
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
    host = fixture.componentInstance;
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('calendar/en'));
    await settle();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  });

  it('emits the range it draws on the first render', () => {
    expect(host.ranges.at(0)).toEqual({ start: MONDAY, end: '2026-09-28', view: 'week' });
    expect(root().querySelector('.ct-range')?.textContent.trim()).toMatch(/21\s*–\s*27 Sept 2026/);
  });

  it('steps by one unit of the view and emits each new range once', async () => {
    button('Next').click();
    await settle();
    expect(host.anchor()).toBe('2026-09-28');

    host.view.set('month');
    await settle();
    button('Previous').click();
    await settle();

    expect(host.anchor()).toBe('2026-08-28');
    expect(host.ranges.map((range) => `${range.view} ${range.start}`)).toEqual([
      `week ${MONDAY}`,
      'week 2026-09-28',
      'month 2026-08-31',
      'month 2026-07-27',
    ]);
  });

  it('moves no range when a step stays inside it', async () => {
    host.anchor.set('2026-09-23');
    await settle();
    expect(host.ranges).toHaveLength(1);
  });

  it('opens the filters, swaps to the settings in place, and closes from the pressed button', async () => {
    const filters = button('Filters');
    expect(filters.getAttribute('aria-pressed')).toBe('false');

    filters.click();
    await settle();
    expect(host.panel()).toBe('filters');
    expect(filters.getAttribute('aria-pressed')).toBe('true');
    expect(root().querySelector('.spec-filters')?.closest('dialog')).not.toBeNull();
    expect(root().querySelector('.spec-clear')?.closest('.drawer-footer')).not.toBeNull();

    button('Settings').click();
    await settle();
    expect(host.panel()).toBe('settings');
    expect(root().querySelector('lib-calendar-settings')).not.toBeNull();
    expect(root().querySelector('.drawer-footer')).toBeNull();

    button('Settings').click();
    await settle();
    expect(host.panel()).toBeNull();
  });

  it('keeps the host scope on projected content', () => {
    expect(ScopeProbe.scopes.length).toBeGreaterThan(0);
    expect(ScopeProbe.scopes.at(-1)).toBeNull();
  });

  it('draws no Filters button when the host projects no filters', async () => {
    host.withFilters.set(false);
    await settle();
    expect(hasButton('Filters')).toBe(false);
  });

  it('counts active filters on the Filters button, in its name too', async () => {
    host.filtersActive.set(2);
    await settle();
    const filters = button('Filters');
    expect(filters.querySelector('.ct-count')?.textContent.trim()).toBe('2');
    expect(filters.textContent).toContain('2 active');
  });

  it('draws every control inline on a wide host, with no overflow button', async () => {
    await resize(1800);
    expect(root().querySelector('.ct-segment')).not.toBeNull();
    expect(hasButton('Refresh')).toBe(true);
    expect(hasButton('More')).toBe(false);
  });

  it('folds controls into the overflow panel as the host narrows', async () => {
    await resize(CALENDAR_TOOLBAR_BREAKPOINTS.create - 1);
    expect(root().querySelector('.ct-segment')).toBeNull();
    expect(hasButton('Refresh')).toBe(false);
    expect(hasButton('Filters')).toBe(false);
    expect(hasButton('New entry')).toBe(false);
    expect(button('Today').querySelector('svg')).not.toBeNull();

    button('More').click();
    await settle();
    const panel = document.querySelector('.ct-overflow');
    if (panel === null) throw new Error('overflow panel not rendered');
    const names = [...panel.querySelectorAll('button')].map((element) =>
      element.textContent.trim(),
    );
    expect(names).toEqual(expect.arrayContaining(['Filters', 'Settings', 'Refresh']) as string[]);
    // Create and the view switch float instead.
    expect(names).not.toContain('New entry');
    expect(panel.querySelector('.ct-view-select')).toBeNull();
  });

  it('floats Create and the view switch in the corner once Create folds', async () => {
    await resize(CALENDAR_TOOLBAR_BREAKPOINTS.create);
    expect(fab('New entry')).toBeNull();

    await resize(CALENDAR_TOOLBAR_BREAKPOINTS.create - 1);
    fab('New entry')?.click();
    await settle();
    expect(host.created).toEqual([null]);

    fab('View')?.click();
    await settle();
    const rows = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    expect(rows.find((row) => row.getAttribute('aria-checked') === 'true')?.textContent).toContain(
      'Week',
    );
    rows.find((row) => row.textContent.includes('Month'))?.click();
    await settle();
    expect(host.view()).toBe('month');
  });

  it('closes an open panel when the host crosses into the overlay width', async () => {
    await resize(1800);
    host.panel.set('filters');
    await settle();
    expect(calendar().hasAttribute('data-panel-overlay')).toBe(false);

    await resize(800);
    expect(calendar().hasAttribute('data-panel-overlay')).toBe(true);
    expect(host.panel()).toBeNull();
  });

  it('opens the day from a day number and emits create with no slot from the button', async () => {
    host.view.set('month');
    await settle();
    const day = root().querySelector<HTMLButtonElement>('.mc-day');
    if (day === null) throw new Error('day not rendered');
    day.click();
    await settle();
    expect(host.view()).toBe('day');

    button('New entry').click();
    await settle();
    expect(host.created).toEqual([null]);
  });
});

describe('Calendar copy', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  });

  it('reads keys the consumer overrides in place of its own, in templates and in code', async () => {
    ResizeObserverStub.instances.length = 0;
    globalThis.ResizeObserver = ResizeObserverStub;
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({
          'calendar.next': 'customer.next',
          'calendar.filters': 'customer.filters',
        }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { next: 'Later', filters: 'Narrow down' } }, 'en', {
      merge: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('calendar/en'));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const calendar = root.querySelector('lib-calendar');
    if (calendar === null) throw new Error('calendar not rendered');
    ResizeObserverStub.resize(calendar, 1800);
    fixture.componentInstance.panel.set('filters');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('lib-calendar-toolbar button[aria-label="Later"]')).not.toBeNull();
    expect(root.querySelector('.drawer-title')?.textContent.trim()).toBe('Narrow down');
  });
});
