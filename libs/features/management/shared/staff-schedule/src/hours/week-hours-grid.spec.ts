import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import type { BusinessHourViewDto } from '@api/appointments';
import { readFileSync } from 'node:fs';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { weekFromShop } from '../form/hours-draft';
import type { HoursFormValue } from '../form/hours.form.types';
import { staffScheduleInlineLoader } from '../staff-schedule.i18n';
import { WeekHoursGrid } from './week-hours-grid';

const styles = readFileSync('src/hours/week-hours-grid.scss', 'utf8');

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

@Component({
  imports: [WeekHoursGrid],
  template: `
    <lib-week-hours-grid
      idPrefix="grid"
      language="en"
      [form]="week"
      [reference]="reference()"
      [maxRanges]="maxRanges()"
      [fallbackRange]="fallback"
      [offText]="offText()"
      [copyToAllText]="copyText()"
    />
  `,
})
class Host {
  readonly model = signal<HoursFormValue>(
    weekFromShop([
      { dayOfWeek: 1, openTime: '09:00', closeTime: '14:30' },
      { dayOfWeek: 1, openTime: '17:00', closeTime: '21:00' },
      { dayOfWeek: 3, openTime: '10:00', closeTime: '18:00' },
    ]),
  );
  readonly week = form(this.model);
  readonly fallback = { startTime: '09:00', endTime: '17:00' };
  readonly reference = signal<readonly BusinessHourViewDto[] | null>(null);
  readonly maxRanges = signal<number | null>(null);
  readonly offText = signal('');
  readonly copyText = signal('');
}

describe('WeekHoursGrid', () => {
  let fixture: ComponentFixture<Host>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function day(index: number): HTMLElement {
    const found = Array.from(host().querySelectorAll<HTMLElement>('.hours-day')).at(index);
    if (found === undefined) throw new Error(`day ${index} not rendered`);
    return found;
  }

  function buttonIn(scope: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(scope.querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    );
  }

  async function toggle(index: number): Promise<void> {
    const found = host().querySelector<HTMLInputElement>(`#grid-day-${index}`);
    if (found === null) throw new Error(`switch ${index} not rendered`);
    found.click();
    await settle();
  }

  /** As plain data: Signal Forms tags each array item with a symbol key. */
  function days(): HoursFormValue['days'] {
    return (JSON.parse(JSON.stringify(fixture.componentInstance.model())) as HoursFormValue).days;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en' },
          loader: EmptyLoader,
        }),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('field/en'));
    await firstValueFrom(
      transloco.load('managementStaffSchedule/en', { inlineLoader: staffScheduleInlineLoader }),
    );
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  it('draws seven days, Monday first, each switch named by its day', () => {
    expect(host().querySelectorAll('.hours-day')).toHaveLength(7);
    expect(host().querySelector('label[for="grid-day-0"]')?.textContent.trim()).toBe('Monday');
    expect(day(0).querySelectorAll('.hours-range')).toHaveLength(2);
  });

  it('starts a day switched on from the nearest earlier open day', async () => {
    await toggle(1);

    expect(days()[1]).toEqual({
      dayOfWeek: 2,
      working: true,
      ranges: [
        { startTime: '09:00', endTime: '14:30' },
        { startTime: '17:00', endTime: '21:00' },
      ],
    });
  });

  it('starts from the fallback range when no earlier day is open', async () => {
    fixture.componentInstance.model.set(weekFromShop([]));
    await settle();

    await toggle(2);

    expect(days()[2]?.ranges).toEqual([{ startTime: '09:00', endTime: '17:00' }]);
  });

  it("starts from the reference's hours that day when there is a reference", async () => {
    fixture.componentInstance.reference.set([
      { dayOfWeek: 2, openTime: '11:00', closeTime: '19:00' },
    ]);
    await settle();

    await toggle(1);

    expect(days()[1]?.ranges).toEqual([{ startTime: '11:00', endTime: '19:00' }]);
    expect(day(1).textContent).toContain('Shop 11:00–19:00');
  });

  it('copies a day to every open day without a reference, and leaves closed days closed', async () => {
    buttonIn(day(2), 'Copy to every open day')?.click();
    await settle();

    expect(days()[0]?.ranges).toEqual([{ startTime: '10:00', endTime: '18:00' }]);
    expect(days()[1]?.working).toBe(false);
    expect(days()[6]?.working).toBe(false);
  });

  it('copies a day to every day the reference opens', async () => {
    fixture.componentInstance.reference.set([
      { dayOfWeek: 1, openTime: '09:00', closeTime: '21:00' },
      { dayOfWeek: 5, openTime: '09:00', closeTime: '21:00' },
    ]);
    await settle();

    buttonIn(day(2), 'Copy to every open day')?.click();
    await settle();

    expect(days()[4]).toEqual({
      dayOfWeek: 5,
      working: true,
      ranges: [{ startTime: '10:00', endTime: '18:00' }],
    });
    expect(days()[1]?.working).toBe(false);
  });

  it('takes away Add range at the limit', async () => {
    fixture.componentInstance.maxRanges.set(2);
    await settle();

    expect(buttonIn(day(0), 'Add range')).toBeUndefined();
    expect(buttonIn(day(2), 'Add range')).toBeDefined();
  });

  it('switches a day off when its last range goes', async () => {
    day(2).querySelector<HTMLButtonElement>('button[aria-label="Remove range"]')?.click();
    await settle();

    expect(days()[2]?.working).toBe(false);
    expect(day(2).textContent).toContain('Day off');
  });

  it("shows the host's own words for a closed day and for Copy", async () => {
    fixture.componentInstance.offText.set('Closed');
    fixture.componentInstance.copyText.set('Copy to all open days');
    await settle();

    expect(day(1).textContent).toContain('Closed');
    expect(buttonIn(day(0), 'Copy to all open days')).toBeDefined();
  });

  it('keeps a range row inside a narrow card', () => {
    const row = /\.hours-range \{[^}]*\}/.exec(styles)?.[0] ?? '';
    const picker = /lib-time-picker \{[^}]*\}/.exec(styles)?.[0] ?? '';
    // A fixed picker width pushed the remove button out of a 390px phone.
    expect(row).toContain('flex-wrap: wrap');
    expect(picker).toContain('min-width: 0');
    expect(picker).not.toMatch(/(^|[^-])width:/m);
  });
});
