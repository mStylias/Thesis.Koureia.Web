import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { CalendarPanel, CalendarView } from '../calendar.types';
import { toolbarLayout } from '../core/toolbar-layout';
import type { CalendarToolbarLayout } from '../core/toolbar-layout.types';
import { CalendarToolbar } from './calendar-toolbar';
import type { CalendarNavigation } from './calendar-toolbar.types';

@Component({
  imports: [CalendarToolbar],
  template: `
    <lib-calendar-toolbar
      [layout]="layout()"
      label="21–27 Sep 2026"
      anchor="2026-09-21"
      locale="en-GB"
      [filtersActive]="filtersActive()"
      [refreshing]="refreshing()"
      [createLabel]="createLabel()"
      [(view)]="view"
      [(panel)]="panel"
      (navigate)="steps.push($event)"
      (refresh)="refreshes = refreshes + 1"
      (create)="creates = creates + 1"
    />
  `,
})
class Host {
  readonly layout = signal<CalendarToolbarLayout>(toolbarLayout(Number.POSITIVE_INFINITY));
  readonly view = signal<CalendarView>('week');
  readonly panel = signal<CalendarPanel>(null);
  readonly filtersActive = signal(0);
  readonly refreshing = signal(false);
  readonly createLabel = signal('');
  readonly steps: CalendarNavigation[] = [];
  refreshes = 0;
  creates = 0;
}

describe('CalendarToolbar', () => {
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

  function buttons(): HTMLButtonElement[] {
    return [...root().querySelectorAll<HTMLButtonElement>('button')];
  }

  /** The accessible name as a screen reader would compute it for these buttons. */
  function nameOf(button: HTMLButtonElement): string {
    return (button.getAttribute('aria-label') ?? button.textContent).replace(/\s+/g, ' ').trim();
  }

  function button(name: string): HTMLButtonElement {
    const found = buttons().find((candidate) => nameOf(candidate).startsWith(name));
    if (found === undefined) throw new Error(`button "${name}" not rendered`);
    return found;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await settle();
    // The date picker names its own toggle from its own scope.
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('calendar/en'));
    await firstValueFrom(transloco.load('datePicker/en'));
    await settle();
  });

  it('is a named group whose every button has a name', () => {
    const bar = root().querySelector('.ct-bar');
    expect(bar?.getAttribute('role')).toBe('group');
    expect(bar?.getAttribute('aria-label')).toBe('Calendar tools');
    for (const candidate of buttons()) {
      expect(nameOf(candidate)).not.toBe('');
    }
  });

  it('steps through today, previous and next', () => {
    button('Today').click();
    button('Previous').click();
    button('Next').click();

    expect(host.steps).toEqual(['today', 'previous', 'next']);
  });

  it('marks the view on show as pressed and switches on a press', async () => {
    expect(button('Week').getAttribute('aria-pressed')).toBe('true');
    expect(button('Month').getAttribute('aria-pressed')).toBe('false');

    button('Month').click();
    await settle();

    expect(host.view()).toBe('month');
    expect(button('Month').getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles the filters and the settings, each pressed while it is shown', async () => {
    button('Filters').click();
    await settle();
    expect(host.panel()).toBe('filters');
    expect(button('Filters').getAttribute('aria-pressed')).toBe('true');
    expect(button('Settings').getAttribute('aria-pressed')).toBe('false');

    button('Settings').click();
    await settle();
    expect(host.panel()).toBe('settings');

    button('Settings').click();
    await settle();
    expect(host.panel()).toBeNull();
  });

  it('says how many filters are set, in the name as well as the count', async () => {
    host.filtersActive.set(2);
    await settle();

    const filters = button('Filters');
    expect(filters.querySelector('.ct-count')?.getAttribute('aria-hidden')).toBe('true');
    expect(filters.textContent.replace(/\s+/g, ' ')).toContain(', 2 active');
  });

  it('blocks a second refresh while one is running', async () => {
    button('Refresh').click();
    expect(host.refreshes).toBe(1);

    host.refreshing.set(true);
    await settle();
    button('Refresh').click();
    expect(host.refreshes).toBe(1);
  });

  it('names the create button with the host copy, or the generic fallback', async () => {
    expect(button('New entry')).toBeDefined();

    host.createLabel.set('New appointment');
    await settle();
    button('New appointment').click();
    expect(host.creates).toBe(1);
  });

  it('offers the overflow button only once something folded', async () => {
    expect(buttons().some((candidate) => nameOf(candidate) === 'More')).toBe(false);

    host.layout.set(toolbarLayout(320));
    await settle();
    expect(button('More').getAttribute('aria-haspopup')).not.toBeNull();
  });
});
