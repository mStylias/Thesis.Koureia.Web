import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { IsoWeekday } from '@ui/date-picker';
import type {
  CalendarColumn,
  CalendarEvent,
  CalendarHours,
  CalendarResource,
  CalendarSlot,
  CalendarTimeScale,
} from '../calendar.types';
import { zoneClock } from '../core/date-math';
import { CalendarTimeGrid } from './calendar-time-grid';

const MONDAY = '2026-09-21';
const TUESDAY = '2026-09-22';
const SUNDAY = '2026-09-27';

const RESOURCES: readonly CalendarResource[] = [
  { id: 'a', label: 'Seat A', swatch: 1, initials: 'A' },
  { id: 'b', label: 'Seat B', swatch: 2 },
];

const HOURS: readonly CalendarHours[] = ([1, 2, 3, 4, 5, 6] as IsoWeekday[]).map((weekday) => ({
  weekday,
  open: '09:00',
  close: '18:00',
}));

const EVENTS: readonly CalendarEvent[] = [
  {
    id: 'e1',
    date: MONDAY,
    start: '09:00',
    end: '10:00',
    title: 'Trim',
    resourceId: 'a',
    badge: { label: 'Confirmed', tone: 'success' },
  },
  { id: 'e2', date: MONDAY, start: '09:30', end: '10:30', title: 'Shave', resourceId: 'b' },
  {
    id: 'e3',
    date: TUESDAY,
    start: '11:00',
    end: '11:30',
    title: 'Colour',
    resourceId: 'a',
    muted: true,
  },
];

/** Six on top of each other: four draw, two go behind the chip. */
const CROWD: readonly CalendarEvent[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id, index) => ({
  id,
  date: MONDAY,
  start: `11:${(index * 5).toString().padStart(2, '0')}`,
  end: '13:00',
  title: id,
  resourceId: 'a',
}));

@Component({
  imports: [CalendarTimeGrid],
  template: `
    <lib-calendar-time-grid
      [columns]="columns()"
      [events]="events()"
      [resources]="resources"
      [hours]="hours()"
      [timeScale]="scale()"
      [showTime]="showTime()"
      [resourceLabel]="resourceLabel()"
      timezone="UTC"
      locale="en-GB"
      [(selectedEventId)]="selectedEventId"
      [(selectedSlot)]="selectedSlot"
      (eventOpen)="opened.push($event)"
      (slotCreate)="created.push($event)"
    />
  `,
})
class Host {
  readonly columns = signal<readonly CalendarColumn[]>([
    { date: MONDAY },
    { date: TUESDAY },
    { date: SUNDAY },
  ]);
  readonly events = signal<readonly CalendarEvent[]>(EVENTS);
  readonly resources = RESOURCES;
  readonly hours = signal<readonly CalendarHours[]>(HOURS);
  readonly scale = signal<CalendarTimeScale>(30);
  readonly showTime = signal(false);
  readonly resourceLabel = signal('');
  readonly selectedEventId = signal<string | null>(null);
  readonly selectedSlot = signal<CalendarSlot | null>(null);
  readonly opened: CalendarEvent[] = [];
  readonly created: CalendarSlot[] = [];
}

describe('CalendarTimeGrid', () => {
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

  function grid(): HTMLElement {
    const found = root().querySelector<HTMLElement>('lib-calendar-time-grid');
    if (found === null) throw new Error('grid not rendered');
    return found;
  }

  function columns(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('.tg-col')];
  }

  function column(index: number): HTMLElement {
    const found = columns().at(index);
    if (found === undefined) throw new Error(`column ${index.toString()} not rendered`);
    return found;
  }

  function heads(): string[] {
    return [...root().querySelectorAll<HTMLElement>('.tg-head')].map(
      (head) => head.querySelector('.tg-head-text')?.textContent.trim() ?? '',
    );
  }

  function tile(id: string): HTMLElement {
    const found = [...root().querySelectorAll<HTMLElement>('[libCalendarTile]')].find((element) =>
      element.getAttribute('aria-label')?.includes(id),
    );
    if (found === undefined) throw new Error(`tile ${id} not rendered`);
    return found;
  }

  function styleVar(element: HTMLElement, name: string): string {
    return element.style.getPropertyValue(name);
  }

  /** jsdom has no layout, so the column is given a height of one pixel per minute. */
  function layOut(element: HTMLElement): void {
    element.getBoundingClientRect = () => ({ top: 0, height: 1440 }) as unknown as DOMRect;
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

  it('draws a head and a column per entry, and says which day is closed', () => {
    expect(heads()).toEqual(['Mon 21', 'Tue 22', 'Sun 27']);
    expect(columns()).toHaveLength(3);
    expect(root().querySelectorAll('.tg-col[data-closed]')).toHaveLength(1);
    expect(root().querySelector('.tg-head-closed')?.textContent.trim()).toBe('Closed');
    expect(column(2).getAttribute('aria-label')).toBe('Sunday, 27 September 2026, Closed');
  });

  it('shades the minutes outside the open hours, and the whole of a closed day', () => {
    const monday = [...column(0).querySelectorAll<HTMLElement>('.tg-band')];
    expect(
      monday.map((band) => [styleVar(band, '--band-start'), styleVar(band, '--band-end')]),
    ).toEqual([
      ['0', '540'],
      ['1080', '1440'],
    ]);
    const sunday = [...column(2).querySelectorAll<HTMLElement>('.tg-band')];
    expect(sunday.map((band) => styleVar(band, '--band-end'))).toEqual(['1440']);
  });

  it('positions tiles by minutes and shares the column count across a cluster', () => {
    expect(styleVar(tile('Trim'), '--tile-start')).toBe('540');
    expect(styleVar(tile('Trim'), '--tile-end')).toBe('600');
    expect(styleVar(tile('Trim'), '--tile-columns')).toBe('2');
    expect(styleVar(tile('Shave'), '--tile-column')).toBe('1');
    expect(styleVar(tile('Colour'), '--tile-columns')).toBe('1');
  });

  it('hides the times on a tile by default, keeps them in its name, and shows them on request', async () => {
    expect(tile('Trim').querySelector('.tile-time')).toBeNull();
    expect(tile('Trim').querySelector('.tile-body .tile-resource')).not.toBeNull();
    expect(tile('Trim').querySelector('.tile-title')?.textContent.trim()).toBe('Trim');
    expect(tile('Trim').getAttribute('aria-label')).toContain('09:00 to 10:00');

    host.showTime.set(true);
    await settle();

    expect(tile('Trim').querySelector('.tile-head .tile-time')?.textContent.trim()).toBe(
      '09:00–10:00',
    );
    expect(tile('Trim').querySelector('.tile-time-end')?.textContent).toBe('–10:00');
    expect(tile('Trim').querySelector('.tile-head .tile-resource')).not.toBeNull();
    expect(tile('Trim').querySelector('.tile-body .tile-resource')).toBeNull();
  });

  it('names a tile with its times, title, resource and badge, and marks a muted one', () => {
    expect(tile('Trim').getAttribute('aria-label')).toBe('09:00 to 10:00, Trim, Seat A, Confirmed');
    expect(tile('Trim').getAttribute('data-swatch')).toBe('1');
    expect(tile('Colour').hasAttribute('data-muted')).toBe(true);
  });

  it('speaks the host noun before the resource in a tile name', async () => {
    host.resourceLabel.set('Seat');
    await settle();

    expect(tile('Trim').getAttribute('aria-label')).toBe(
      '09:00 to 10:00, Trim, Seat: Seat A, Confirmed',
    );
  });

  it('heads a resource column with the resource and drops its name from the tiles', async () => {
    host.columns.set([
      { date: MONDAY, resourceId: 'a' },
      { date: MONDAY, resourceId: 'b' },
    ]);
    await settle();

    expect(heads()).toEqual(['Seat A', 'Seat B']);
    expect(column(0).querySelectorAll('[libCalendarTile]')).toHaveLength(1);
    expect(tile('Trim').getAttribute('aria-label')).toBe('09:00 to 10:00, Trim, Confirmed');
  });

  it('scrolls a selection made outside the grid into view, once', async () => {
    const reveal = vi.fn();
    // Shadows whatever `Element` has, so deleting it afterwards restores that.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: reveal,
    });
    try {
      host.selectedEventId.set('e3');
      await settle();

      expect(reveal).toHaveBeenCalledTimes(1);
      expect(reveal.mock.contexts[0]).toBe(tile('Colour'));

      host.events.set([...EVENTS]);
      await settle();
      expect(reveal).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('opens a tile on one click and marks it current', async () => {
    tile('Trim').click();
    await settle();

    expect(host.opened.map((event) => event.id)).toEqual(['e1']);
    expect(host.selectedEventId()).toBe('e1');
    expect(tile('Trim').getAttribute('aria-current')).toBe('true');
    expect(host.created).toEqual([]);
  });

  it('creates from a double click on empty space, at the row under the pointer', async () => {
    host.columns.set([{ date: MONDAY, resourceId: 'a' }]);
    await settle();
    const target = column(0);
    layOut(target);

    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientY: 545 }));
    target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientY: 545 }));
    await settle();

    expect(host.selectedSlot()).toEqual({ date: MONDAY, time: '09:00', resourceId: 'a' });
    expect(host.created).toEqual([{ date: MONDAY, time: '09:00', resourceId: 'a' }]);
    expect(
      styleVar(column(0).querySelector<HTMLElement>('.tg-slot') ?? target, '--band-start'),
    ).toBe('540');
  });

  it('folds the events past four columns into one chip', async () => {
    host.events.set([...EVENTS, ...CROWD]);
    await settle();

    const chips = [...root().querySelectorAll<HTMLElement>('.tg-more')];
    expect(chips.map((chip) => chip.textContent.trim())).toEqual(['+2']);
    expect(chips[0]?.getAttribute('aria-label')).toBe('2 more, from 11:20 to 13:00');
    expect(column(0).querySelectorAll('[libCalendarTile]')).toHaveLength(6);
  });

  it('walks the rows with the arrow keys from the first open hour, creates with Enter', async () => {
    const target = column(0);
    const key = (name: string): boolean =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

    key('ArrowDown');
    await settle();
    expect(host.selectedSlot()).toEqual({ date: MONDAY, time: '09:00' });

    key('ArrowDown');
    key('ArrowDown');
    key('ArrowUp');
    await settle();
    expect(host.selectedSlot()).toEqual({ date: MONDAY, time: '09:30' });

    key('Enter');
    expect(host.created).toEqual([{ date: MONDAY, time: '09:30' }]);

    key('Escape');
    await settle();
    expect(host.selectedSlot()).toBeNull();
    expect(root().querySelector('.tg-slot')).toBeNull();
  });

  it('is a focusable group with a hint, not a grid of cells', () => {
    const target = column(0);
    expect(target.getAttribute('role')).toBe('group');
    expect(target.getAttribute('tabindex')).toBe('0');
    const hint = target.getAttribute('aria-describedby') ?? '';
    expect(root().querySelector(`[id="${hint}"]`)?.textContent).toContain('arrow keys');
  });

  it('draws the now line on today only', async () => {
    const today = zoneClock('UTC').date;
    const other = today === MONDAY ? TUESDAY : MONDAY;
    host.columns.set([{ date: today }, { date: other }]);
    await settle();

    expect(column(0).querySelector('.tg-now')).not.toBeNull();
    expect(column(1).querySelector('.tg-now')).toBeNull();
    expect(column(0).getAttribute('aria-label')).toContain('Today');
  });

  it('sets the rows per hour from the scale', async () => {
    expect(styleVar(grid(), '--tg-slots-per-hour')).toBe('2');
    host.scale.set(5);
    await settle();
    expect(styleVar(grid(), '--tg-slots-per-hour')).toBe('12');
  });
});
