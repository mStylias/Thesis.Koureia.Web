import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { IsoWeekday } from '@ui/date-picker';
import type {
  CalendarEvent,
  CalendarHours,
  CalendarResource,
  CalendarSlot,
} from '../calendar.types';
import { CalendarMonth } from './calendar-month';

const ANCHOR = '2026-03-10';

const RESOURCES: readonly CalendarResource[] = [{ id: 'a', label: 'Seat A', swatch: 1 }];

const HOURS: readonly CalendarHours[] = ([1, 2, 3, 4, 5, 6] as IsoWeekday[]).map((weekday) => ({
  weekday,
  open: '09:00',
  close: '18:00',
}));

/** Five on the 15th, out of order, one on the 3rd. */
const EVENTS: readonly CalendarEvent[] = [
  { id: 'late', date: ANCHOR, start: '16:00', end: '17:00', title: 'Late', resourceId: 'a' },
  {
    id: 'first',
    date: ANCHOR,
    start: '09:00',
    end: '10:00',
    title: 'First',
    badge: { label: 'Confirmed', tone: 'success' },
  },
  { id: 'noon', date: ANCHOR, start: '12:00', end: '13:00', title: 'Noon' },
  { id: 'two', date: ANCHOR, start: '14:00', end: '15:00', title: 'Two' },
  { id: 'three', date: ANCHOR, start: '15:00', end: '16:00', title: 'Three' },
  { id: 'other', date: '2026-03-03', start: '10:00', end: '10:30', title: 'Other' },
];

@Component({
  imports: [CalendarMonth],
  template: `
    <lib-calendar-month
      [anchor]="anchor()"
      [events]="events()"
      [resources]="resources"
      [hours]="hours"
      timezone="UTC"
      locale="en-GB"
      [(selectedEventId)]="selectedEventId"
      (eventOpen)="opened.push($event)"
      (dayOpen)="days.push($event)"
      (slotCreate)="created.push($event)"
    />
  `,
})
class Host {
  readonly anchor = signal(ANCHOR);
  readonly events = signal<readonly CalendarEvent[]>(EVENTS);
  readonly resources = RESOURCES;
  readonly hours = HOURS;
  readonly selectedEventId = signal<string | null>(null);
  readonly opened: CalendarEvent[] = [];
  readonly days: string[] = [];
  readonly created: CalendarSlot[] = [];
}

describe('CalendarMonth', () => {
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

  function cells(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('.mc-cell')];
  }

  function cell(date: string): HTMLElement {
    const found = root().querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (found === null) throw new Error(`cell ${date} not rendered`);
    return found;
  }

  function key(target: HTMLElement, name: string, shiftKey = false): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true }));
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
    host = fixture.componentInstance;
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('calendar/en'));
    await settle();
  });

  it('draws whole weeks, Monday first, with the other months recessed and closed days marked', () => {
    expect(cells()).toHaveLength(42);
    expect(cells()[0]?.dataset['date']).toBe('2026-02-23');
    expect(root().querySelectorAll('.mc-cell[data-outside]')).toHaveLength(11);
    expect(root().querySelectorAll('.mc-cell[data-closed]')).toHaveLength(6);
    expect(root().querySelector('.mc-weekday')?.textContent.trim()).toBe('Mon');
    expect(root().querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe('March 2026');
  });

  it('lists a day in start order and gives the last row to the chip', () => {
    const titles = [...cell(ANCHOR).querySelectorAll('.mc-tile-title')].map((el) =>
      el.textContent.trim(),
    );
    expect(titles).toEqual(['First', 'Noon']);
    expect(cell(ANCHOR).querySelector('.mc-more')?.textContent.trim()).toBe('+3');
    expect(cell(ANCHOR).getAttribute('aria-label')).toBe('Tuesday, 10 March 2026, 5 entries');
  });

  it('names a row with its times, title and badge, and opens it on click', async () => {
    const row = cell(ANCHOR).querySelector<HTMLElement>('.mc-tile');
    if (row === null) throw new Error('row not rendered');
    expect(row.getAttribute('aria-label')).toBe('09:00 to 10:00, First, Confirmed');

    row.click();
    await settle();
    expect(host.opened.map((event) => event.id)).toEqual(['first']);
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(host.created).toEqual([]);
  });

  it('opens the day from its number and creates from a double click on empty space', () => {
    cell(ANCHOR).querySelector<HTMLElement>('.mc-day')?.click();
    cell(ANCHOR).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(host.days).toEqual([ANCHOR]);
    expect(host.created).toEqual([{ date: ANCHOR }]);
  });

  it('has one tab stop that the arrows move, Enter opens and Shift+Enter creates', async () => {
    expect(cells().filter((el) => el.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(cell('2026-03-01').getAttribute('tabindex')).toBe('0');

    key(cell('2026-03-01'), 'ArrowRight');
    await settle();
    expect(cell('2026-03-02').getAttribute('tabindex')).toBe('0');
    expect(cell('2026-03-01').getAttribute('tabindex')).toBe('-1');

    key(cell('2026-03-02'), 'ArrowDown');
    await settle();
    expect(cell('2026-03-09').getAttribute('tabindex')).toBe('0');

    key(cell('2026-03-09'), 'Enter');
    key(cell('2026-03-09'), 'Enter', true);
    expect(host.days).toEqual(['2026-03-09']);
    expect(host.created).toEqual([{ date: '2026-03-09' }]);
  });
});
