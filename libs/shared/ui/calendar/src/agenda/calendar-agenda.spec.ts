import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { CalendarEvent, CalendarResource } from '../calendar.types';
import { CalendarAgenda } from './calendar-agenda';

const RESOURCES: readonly CalendarResource[] = [{ id: 'a', label: 'Seat A', swatch: 1 }];

const EVENTS: readonly CalendarEvent[] = [
  { id: 'wed', date: '2026-03-11', start: '10:00', end: '10:30', title: 'Wednesday' },
  { id: 'late', date: '2026-03-09', start: '16:00', end: '17:00', title: 'Late', resourceId: 'a' },
  {
    id: 'early',
    date: '2026-03-09',
    start: '09:00',
    end: '10:00',
    title: 'Early',
    badge: { label: 'Confirmed', tone: 'success' },
  },
  { id: 'next', date: '2026-04-02', start: '09:00', end: '10:00', title: 'Next month' },
];

@Component({
  imports: [CalendarAgenda],
  template: `
    <lib-calendar-agenda
      [anchor]="anchor()"
      [events]="events"
      [resources]="resources"
      timezone="UTC"
      locale="en-GB"
      [(selectedEventId)]="selectedEventId"
      (eventOpen)="opened.push($event)"
    />
  `,
})
class Host {
  readonly anchor = signal('2026-03-15');
  readonly events = EVENTS;
  readonly resources = RESOURCES;
  readonly selectedEventId = signal<string | null>(null);
  readonly opened: CalendarEvent[] = [];
}

describe('CalendarAgenda', () => {
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

  it('groups the month by day in order, skipping empty days and other months', () => {
    const headings = [...root().querySelectorAll('.ag-heading')].map((el) => el.textContent.trim());
    expect(headings).toEqual(['Monday, 9 March 2026', 'Wednesday, 11 March 2026']);
    const titles = [...root().querySelectorAll('.ag-title')].map((el) => el.textContent.trim());
    expect(titles).toEqual(['Early', 'Late', 'Wednesday']);
  });

  it('names a row with its times, title, resource and badge, and opens it on click', async () => {
    const rows = [...root().querySelectorAll<HTMLElement>('.ag-row')];
    expect(rows[0]?.getAttribute('aria-label')).toBe('09:00 to 10:00, Early, Confirmed');
    expect(rows[1]?.getAttribute('aria-label')).toBe('16:00 to 17:00, Late, Seat A');

    rows[1]?.click();
    await settle();
    expect(host.opened.map((event) => event.id)).toEqual(['late']);
    expect(rows[1]?.getAttribute('aria-current')).toBe('true');
  });

  it('says when the month has nothing', async () => {
    host.anchor.set('2026-05-01');
    await settle();

    expect(root().querySelectorAll('.ag-row')).toHaveLength(0);
    expect(root().querySelector('.ag-empty')?.textContent.trim()).toBe('Nothing this month.');
  });
});
