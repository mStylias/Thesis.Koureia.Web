import { Component, getDebugNode, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { IsoWeekday } from '@ui/date-picker';
import { Tooltip } from '@ui/tooltip';
import type { CalendarHours } from '../calendar.types';
import { CalendarYear } from './calendar-year';

const HOURS: readonly CalendarHours[] = ([1, 2, 3, 4, 5, 6] as IsoWeekday[]).map((weekday) => ({
  weekday,
  open: '09:00',
  close: '18:00',
}));

@Component({
  imports: [CalendarYear],
  template: `
    <lib-calendar-year
      anchor="2026-09-15"
      [dayCounts]="counts()"
      [hours]="hours"
      timezone="UTC"
      locale="en-GB"
      (dayOpen)="days.push($event)"
      (monthOpen)="months.push($event)"
    />
  `,
})
class Host {
  // A Tuesday with four, a Friday with one, and a Sunday, which is closed.
  readonly counts = signal<Record<string, number>>({
    '2026-03-10': 4,
    '2026-03-13': 1,
    '2026-03-15': 9,
  });
  readonly hours = HOURS;
  readonly days: string[] = [];
  readonly months: string[] = [];
}

describe('CalendarYear', () => {
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

  function day(date: string): HTMLElement {
    const found = root().querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (found === null) throw new Error(`day ${date} not rendered`);
    return found;
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

  it('draws twelve months with a legend of four steps', () => {
    const headings = [...root().querySelectorAll('.yc-heading')].map((el) => el.textContent.trim());
    expect(headings).toHaveLength(12);
    expect(headings[0]).toBe('January 2026');
    expect(root().querySelectorAll('.yc-legend-swatch')).toHaveLength(4);
    expect(root().querySelectorAll('[data-date]')).toHaveLength(365);
  });

  it('tints a day by its count, names the count, and leaves a closed day untinted', () => {
    expect(day('2026-03-10').dataset['step']).toBe('2');
    expect(getDebugNode(day('2026-03-10'))?.injector.get(Tooltip).libTooltip()).toBe('4 entries');
    expect(getDebugNode(day('2026-03-11'))?.injector.get(Tooltip).libTooltip()).toBe('');
    expect(day('2026-03-10').getAttribute('aria-label')).toBe('Tuesday, 10 March 2026, 4 entries');
    expect(day('2026-03-13').dataset['step']).toBe('1');
    expect(day('2026-03-11').dataset['step']).toBe('0');
    expect(day('2026-03-15').dataset['step']).toBeUndefined();
    expect(day('2026-03-15').hasAttribute('data-closed')).toBe(true);
  });

  it('opens a day on click or Enter, and walks a month with the arrows', async () => {
    day('2026-03-10').click();
    expect(host.days).toEqual(['2026-03-10']);

    expect(day('2026-03-01').getAttribute('tabindex')).toBe('0');
    day('2026-03-01').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await settle();
    expect(day('2026-03-08').getAttribute('tabindex')).toBe('0');
    expect(day('2026-03-01').getAttribute('tabindex')).toBe('-1');

    day('2026-03-08').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.days).toEqual(['2026-03-10', '2026-03-08']);
  });

  it('opens the month from its heading or a press outside its days', () => {
    root().querySelector<HTMLElement>('[data-month="2026-03"] .yc-heading-button')?.click();
    root().querySelector<HTMLElement>('[data-month="2026-05"]')?.click();

    expect(host.months).toEqual(['2026-03-01', '2026-05-01']);
  });

  it('opens only the day when a day in the card is pressed', () => {
    day('2026-03-10').click();

    expect(host.days).toEqual(['2026-03-10']);
    expect(host.months).toEqual([]);
  });
});
