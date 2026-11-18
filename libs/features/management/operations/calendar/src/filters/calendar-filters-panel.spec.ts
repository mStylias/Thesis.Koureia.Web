import { Injectable, computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  provideTransloco,
  provideTranslocoScope,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type { CalendarServiceCategoryViewDto } from '@api/appointments';
import type { CalendarResource } from '@ui/calendar';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { emptyFilters } from '../calendar-mapping';
import { appointmentsInlineLoader } from '@features/management-shared-appointments';

import { calendarInlineLoader, calendarTranslocoScope } from '../calendar.i18n';
import { CalendarStore } from '../calendar.store';
import type { CalendarFilters } from '../calendar.types';
import { CalendarFiltersPanel } from './calendar-filters-panel';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

/** The part of the store the panel reads. */
function storeStub() {
  const filters = signal<CalendarFilters>(emptyFilters());
  return {
    filters,
    allResources: signal<readonly CalendarResource[]>([
      { id: 'n', label: 'Nikos P.', swatch: 1 },
      { id: 'm', label: 'Maria K.', swatch: 2 },
    ]),
    categories: signal<readonly CalendarServiceCategoryViewDto[]>([{ id: 'c1', name: 'Haircut' }]),
    customers: computed(() => undefined),
  };
}

describe('CalendarFiltersPanel', () => {
  let fixture: ComponentFixture<CalendarFiltersPanel>;
  let store: ReturnType<typeof storeStub>;

  /** The pipe resolves the scope a task later, so a render waits one out. */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function combobox(name: string): HTMLElement {
    const found = [...root().querySelectorAll<HTMLElement>('[role="combobox"]')].find(
      (element) => element.getAttribute('aria-label') === name,
    );
    if (found === undefined) throw new Error(`combobox "${name}" not rendered`);
    return found;
  }

  beforeEach(async () => {
    store = storeStub();
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
          loader: EmptyLoader,
        }),
        // What the page provides for every part of the screen.
        provideTranslocoScope(calendarTranslocoScope),
        { provide: CalendarStore, useValue: store },
      ],
    });
    // Loaded ahead, so the first render does not race the dictionaries it would fetch itself.
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    // `lib-field` holds its label back until its own scope is in. Its copy is not what these assert.
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementCalendar/en', { inlineLoader: calendarInlineLoader }),
    );
    await firstValueFrom(
      transloco.load('managementAppointments/en', { inlineLoader: appointmentsInlineLoader }),
    );
    fixture = TestBed.createComponent(CalendarFiltersPanel);
    // The first render waits on every scope the controls load, so wait for the copy itself.
    await vi.waitFor(async () => {
      await settle();
      expect(combobox('Barbers')).toBeDefined();
    });
  });

  it('labels every facet and names every control', () => {
    expect(
      [...root().querySelectorAll('.field-label')].map((label) => label.textContent.trim()),
    ).toEqual(['Barbers', 'Customers', 'Status', 'Service category']);
    // A `<label for>` cannot name a role="combobox" element, so each control carries its own.
    for (const name of ['Barbers', 'Status', 'Service category']) {
      expect(combobox(name)).toBeDefined();
    }
  });

  it('says what an empty facet means', () => {
    expect(combobox('Barbers').textContent).toContain('All barbers');
    expect(combobox('Status').textContent).toContain('All statuses');
  });

  it('shows the filters the store holds, so a saved view applied elsewhere lands here', async () => {
    store.filters.set({ ...emptyFilters(), statuses: ['pending', 'no_show'] });
    await settle();

    expect(combobox('Status').textContent).toContain('Pending');
    expect(combobox('Status').textContent).toContain('No-show');
  });
});
