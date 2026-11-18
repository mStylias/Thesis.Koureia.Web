import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { CalendarEvent, CalendarResource } from '../calendar.types';
import { CalendarMorePopover } from './calendar-more-popover';

const RESOURCES: readonly CalendarResource[] = [{ id: 'a', label: 'Seat A', swatch: 2 }];

const EVENTS: readonly CalendarEvent[] = [
  { id: 'late', date: '2026-09-21', start: '11:00', end: '11:30', title: 'Shave', resourceId: 'a' },
  {
    id: 'early',
    date: '2026-09-21',
    start: '09:00',
    end: '09:45',
    title: 'Trim',
    resourceId: 'a',
    badge: { label: 'Pending', tone: 'warning' },
    muted: true,
  },
];

@Component({
  imports: [CalendarMorePopover],
  template: `
    <lib-calendar-more-popover
      [events]="events"
      [resources]="resources"
      locale="en-GB"
      resourceLabel="Seat"
      [selectedEventId]="selected()"
      (eventOpen)="opened.push($event)"
    />
  `,
})
class Host {
  readonly events = EVENTS;
  readonly resources = RESOURCES;
  readonly selected = signal<string | null>(null);
  readonly opened: CalendarEvent[] = [];
}

describe('CalendarMorePopover', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function rows(): HTMLButtonElement[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.more-row'),
    ];
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
    await firstValueFrom(TestBed.inject(TranslocoService).load('calendar/en'));
    await settle();
  });

  it('lists the hidden events in start order under a heading', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.more-heading')?.textContent.trim(),
    ).toBe('More entries');
    expect(rows().map((row) => row.querySelector('.more-title')?.textContent)).toEqual([
      'Trim',
      'Shave',
    ]);
  });

  it('names each row with its resource, which it otherwise draws as a colour only', () => {
    // Regression: the rows had no name of their own, so the resource was the bar's colour alone.
    expect(rows().map((row) => row.getAttribute('aria-label'))).toEqual([
      '09:00 to 09:45, Trim, Seat: Seat A, Pending',
      '11:00 to 11:30, Shave, Seat: Seat A',
    ]);
    expect(rows()[0]?.querySelector('.more-bar')?.getAttribute('aria-hidden')).toBe('true');
    expect(rows()[0]?.hasAttribute('data-muted')).toBe(true);
  });

  it('marks the open event and reports the row chosen', async () => {
    host.selected.set('late');
    await settle();
    expect(rows()[1]?.getAttribute('aria-current')).toBe('true');

    rows()[0]?.click();
    expect(host.opened.map((event) => event.id)).toEqual(['early']);
  });
});
