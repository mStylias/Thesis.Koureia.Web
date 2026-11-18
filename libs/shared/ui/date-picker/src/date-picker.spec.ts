import { readFileSync } from 'node:fs';
import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { FormField, form, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { DatePicker } from './date-picker';
import { validateDate } from './validate-date';
import { DatePickerMode, DateRange, DayAvailability, IsoWeekday } from './date-picker.types';
import {
  addDays,
  availabilityFromCapacity,
  availabilityLevel,
  createDateLocaleInfo,
  createMonthGrid,
  formatDate,
  isDateAllowed,
  parseLocalizedDate,
} from './date-picker.utils';

describe('date utilities', () => {
  it('parses and formats using the regional date order', () => {
    expect(parseLocalizedDate('13/07/2026', 'el-GR')).toEqual({
      kind: 'valid',
      date: '2026-07-13',
    });
    expect(parseLocalizedDate('07/13/2026', 'en-US')).toEqual({
      kind: 'valid',
      date: '2026-07-13',
    });
    expect(formatDate('2026-07-13', 'el-GR')).toBe('13/07/2026');
    expect(formatDate('2026-07-13', 'en-US')).toBe('07/13/2026');
  });

  it('distinguishes partial and invalid entries', () => {
    expect(parseLocalizedDate('13/07', 'el-GR')).toEqual({ kind: 'partial' });
    expect(parseLocalizedDate('13/07/26', 'el-GR')).toEqual({ kind: 'partial' });
    expect(parseLocalizedDate('31/02/2026', 'el-GR')).toEqual({ kind: 'invalid' });
    expect(parseLocalizedDate('13 July 2026', 'el-GR')).toEqual({ kind: 'invalid' });
  });

  it('uses the locale week start and builds a stable six-week grid', () => {
    const locale = createDateLocaleInfo('el-GR');
    const rows = createMonthGrid('2026-07', locale, {}, '2026-07-13');

    expect(locale.firstDayOfWeek).toBe(1);
    expect(locale.placeholder).toBe('dd/mm/yyyy');
    expect(rows).toHaveLength(6);
    expect(rows[0][0].date).toBe('2026-06-29');
    expect(rows.flat().find((day) => day.date === '2026-07-13')?.today).toBe(true);
  });

  it('applies backend availability, closures, and recurring days off', () => {
    const constraints = {
      min: '2026-07-01',
      max: '2026-07-31',
      excludedDates: ['2026-07-13'],
      excludedRanges: [{ start: '2026-07-20', end: '2026-07-24' }],
      excludedWeekdays: [7 as IsoWeekday],
    } as const;

    expect(isDateAllowed('2026-07-06', constraints)).toBe(true);
    expect(isDateAllowed('2026-07-12', constraints)).toBe(false);
    expect(isDateAllowed('2026-07-13', constraints)).toBe(false);
    expect(isDateAllowed('2026-07-22', constraints)).toBe(false);
    expect(isDateAllowed('2026-08-01', constraints)).toBe(false);
    expect(isDateAllowed('2026-07-06', { validDates: ['2026-07-07'] })).toBe(false);
  });

  // Regression: an empty list meant "no limit", so a day-less answer opened every day.
  it('allows no date for an empty list of valid dates', () => {
    expect(isDateAllowed('2026-07-06', { validDates: [] })).toBe(false);
    expect(isDateAllowed('2026-07-06', {})).toBe(true);
  });

  it('maps a free share to a level at the 20% and 50% bounds', () => {
    expect(availabilityLevel(undefined)).toBeNull();
    expect(availabilityLevel(0)).toBeNull();
    expect(availabilityLevel(Number.NaN)).toBeNull();
    expect(availabilityLevel(0.19)).toBe('low');
    expect(availabilityLevel(0.2)).toBe('medium');
    expect(availabilityLevel(0.5)).toBe('medium');
    expect(availabilityLevel(0.51)).toBe('high');
  });

  it('builds free shares from day capacity and skips a day with no capacity', () => {
    expect(
      availabilityFromCapacity([
        { date: '2026-07-14', freeSlots: 3, totalSlots: 12 },
        { date: '2026-07-15', freeSlots: 2, totalSlots: 0 },
        { date: '2026-07-16', freeSlots: 9, totalSlots: 6 },
      ]),
    ).toEqual({ '2026-07-14': 0.25, '2026-07-16': 1 });
  });

  it('gives a level only to a selectable day of the shown month', () => {
    const rows = createMonthGrid(
      '2026-07',
      createDateLocaleInfo('el-GR'),
      { excludedDates: ['2026-07-15'] },
      '2026-07-13',
      { '2026-06-30': 1, '2026-07-14': 0.1, '2026-07-15': 1 },
    ).flat();
    const level = (date: string) => rows.find((day) => day.date === date)?.availability;

    expect(level('2026-06-30')).toBeNull();
    expect(level('2026-07-14')).toBe('low');
    expect(level('2026-07-15')).toBeNull();
    expect(level('2026-07-16')).toBeNull();
  });

  it('does timezone-safe calendar arithmetic over leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });
});

@Component({
  imports: [DatePicker],
  template: `
    <lib-date-picker
      [(value)]="value"
      [mode]="mode()"
      [showInput]="showInput()"
      [locale]="locale()"
      [today]="today"
      [startAt]="today"
      [excludedDates]="excludedDates"
      [excludedRanges]="excludedRanges"
      [excludedWeekdays]="excludedWeekdays"
      [readonly]="readonly()"
      [frameless]="frameless()"
      [showClear]="showClear()"
      ariaLabel="Appointment date"
      (touch)="touchCount = touchCount + 1"
    />
  `,
})
class DatePickerHost {
  readonly picker = viewChild.required(DatePicker);
  readonly value = signal('');
  readonly mode = signal<DatePickerMode>('inline');
  readonly showInput = signal(true);
  readonly readonly = signal(false);
  readonly frameless = signal(false);
  readonly showClear = signal(false);
  readonly locale = signal('el-GR');
  readonly today = '2026-07-13';
  readonly excludedDates = ['2026-07-15'];
  readonly excludedRanges: readonly DateRange[] = [];
  readonly excludedWeekdays: readonly IsoWeekday[] = [7];
  touchCount = 0;
}

@Component({
  imports: [DatePicker, FormField],
  template: `
    <lib-date-picker
      [formField]="bookingForm.date"
      mode="inline"
      locale="el-GR"
      today="2026-07-13"
      startAt="2026-07-13"
    />
  `,
})
class SignalFormDatePickerHost {
  readonly model = signal({ date: '' });
  readonly constraints = { min: '2026-07-13' } as const;
  readonly bookingForm = form(this.model, (booking) => {
    required(booking.date);
    validateDate(booking.date, this.constraints);
  });
}

describe('DatePicker', () => {
  let fixture: ComponentFixture<DatePickerHost>;
  let host: DatePickerHost;
  let overlayContainer: OverlayContainer;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'lib-date-picker',
    );
    if (!element) throw new Error('date picker not rendered');
    return element;
  }

  function input(): HTMLInputElement {
    const element = root().querySelector<HTMLInputElement>('input');
    if (!element) throw new Error('date input not rendered');
    return element;
  }

  function panelRoot(): HTMLElement {
    return overlayContainer.getContainerElement();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  async function type(value: string): Promise<void> {
    input().focus();
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true }));
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
    fixture = TestBed.createComponent(DatePickerHost);
    host = fixture.componentInstance;
    overlayContainer = TestBed.inject(OverlayContainer);
    await settle();
    // The lazy scope loads through a dynamic import; without this every
    // message renders as its key.
    await firstValueFrom(TestBed.inject(TranslocoService).load('datePicker/en'));
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('renders an editable inline calendar with a regional placeholder', () => {
    expect(input().placeholder).toBe('dd/mm/yyyy');
    expect(root().querySelector('[role="grid"]')).not.toBeNull();
    expect(root().querySelectorAll('[role="gridcell"]')).toHaveLength(42);
  });

  it('updates the value and calendar immediately after complete typed input', async () => {
    await type('21/08/2026');

    expect(host.value()).toBe('2026-08-21');
    expect(root().querySelector('[data-date="2026-08-21"]')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(root().textContent).toContain('Αύγουστος');
  });

  it('clears the model for partial text and reports a format error on commit', async () => {
    host.value.set('2026-07-14');
    await settle();
    await type('14/07');

    expect(host.value()).toBe('');
    expect(root().querySelector('[role="alert"]')).toBeNull();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(root().querySelector('[role="alert"]')).not.toBeNull();
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('reflects frameless, so a parent can draw the frame for a group', async () => {
    expect(root().hasAttribute('data-frameless')).toBe(false);

    host.frameless.set(true);
    await settle();
    expect(root().hasAttribute('data-frameless')).toBe(true);
  });

  it('navigates to a typed unavailable date without committing it', async () => {
    await type('15/07/2026');
    expect(host.value()).toBe('');
    expect(root().querySelector('[data-date="2026-07-15"]')).not.toBeNull();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('available');
  });

  it('selects an available grid date and formats the field', async () => {
    const day = root().querySelector<HTMLElement>('[data-date="2026-07-14"]');
    day?.click();
    await settle();

    expect(host.value()).toBe('2026-07-14');
    expect(input().value).toBe('14/07/2026');
    expect(root().hasAttribute('data-filled')).toBe(true);
  });

  it('renders calendar-only inline mode when showInput is false', async () => {
    host.showInput.set(false);
    await settle();

    expect(root().querySelector('.date-field')).toBeNull();
    expect(root().querySelector('[role="grid"]')).not.toBeNull();

    host.picker().focus();
    expect(document.activeElement?.getAttribute('role')).toBe('gridcell');

    root().querySelector<HTMLElement>('[data-date="2026-07-14"]')?.click();
    await settle();
    expect(host.value()).toBe('2026-07-14');
  });

  // The field is typed into first. A calendar that opens on focus, on click or
  // on every keystroke covers the rows a user is reading and takes the value
  // away from them mid-entry.
  it('keeps the calendar shut while the user types or clicks the input', async () => {
    host.mode.set('dropdown');
    await settle();

    input().click();
    await settle();
    expect(panelRoot().querySelector('[role="dialog"]')).toBeNull();

    await type('20/08/2026');

    expect(panelRoot().querySelector('[role="dialog"]')).toBeNull();
    // Typing still commits — it just does not open anything.
    expect(host.value()).toBe('2026-08-20');
    expect(input().value).toBe('20/08/2026');
  });

  it('opens the calendar from the toggle and from ArrowDown, and nowhere else', async () => {
    host.mode.set('dropdown');
    await settle();

    root().querySelector<HTMLButtonElement>('.date-toggle')?.click();
    await settle();
    expect(panelRoot().querySelector('[role="dialog"]')).not.toBeNull();

    root().querySelector<HTMLButtonElement>('.date-toggle')?.click();
    await settle();
    expect(panelRoot().querySelector('[role="dialog"]')).toBeNull();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(panelRoot().querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('selects a clicked date in dropdown mode and closes the popover', async () => {
    host.mode.set('dropdown');
    host.showInput.set(false);
    await settle();
    expect(input()).not.toBeNull();
    root().querySelector<HTMLButtonElement>('.date-toggle')?.click();
    await settle();

    const focusedDay = panelRoot().querySelector<HTMLElement>('[data-date="2026-07-13"]');
    const day = panelRoot().querySelector<HTMLElement>('[data-date="2026-07-14"] span');
    day?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    focusedDay?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    focusedDay?.blur();
    await Promise.resolve();
    expect(panelRoot().querySelector('[role="dialog"]')).not.toBeNull();

    day?.click();
    await settle();

    expect(host.value()).toBe('2026-07-14');
    expect(input().value).toBe('14/07/2026');
    expect(panelRoot().querySelector('[role="dialog"]')).toBeNull();
  });

  it('supports PageDown calendar navigation and Escape focus restoration', async () => {
    host.mode.set('dropdown');
    host.locale.set('en-US');
    await settle();
    root().querySelector<HTMLButtonElement>('.date-toggle')?.click();
    await settle();

    const grid = panelRoot().querySelector<HTMLElement>('[role="grid"]');
    grid?.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await settle();
    expect(panelRoot().textContent).toContain('August 2026');

    grid?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(panelRoot().querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(input());
  });

  it('withholds every edit affordance while read-only', async () => {
    host.value.set('2026-07-14');
    host.readonly.set(true);
    await settle();

    expect(root().hasAttribute('data-readonly')).toBe(true);
    expect(input().readOnly).toBe(true);
    expect(root().querySelector('.date-icon-button')).toBeNull();
    expect(root().querySelector<HTMLButtonElement>('.date-today-button')?.disabled).toBe(true);

    root().querySelector<HTMLElement>('[data-date="2026-07-16"]')?.click();
    await settle();
    expect(host.value()).toBe('2026-07-14');
  });

  // The toggle is the field's only adornment by default: no decorative calendar beside the
  // value, and no clear button unless one is asked for — the input is typed into, so emptying
  // it is already a way out.
  it('draws the toggle as the field’s only adornment', async () => {
    host.mode.set('dropdown');
    host.value.set('2026-07-14');
    await settle();

    const adornments = root().querySelectorAll('.date-field .date-icon-button');
    expect(adornments.length).toBe(1);
    expect(adornments[0].classList.contains('date-toggle')).toBe(true);
    expect(adornments[0].getAttribute('aria-label')).toBe('Open calendar');
    // The leading decoration was a direct child of the field; nothing else in
    // the field draws a glyph of its own.
    expect(root().querySelector('.date-field > svg')).toBeNull();
  });

  it('offers a clear button only when asked, and only with something to clear', async () => {
    host.mode.set('dropdown');
    host.showClear.set(true);
    await settle();

    expect(root().querySelector('.date-clear')).toBeNull();

    host.value.set('2026-07-14');
    await settle();

    const clear = root().querySelector<HTMLButtonElement>('.date-clear');
    if (!clear) throw new Error('clear button not rendered');
    expect(clear.getAttribute('aria-label')).toBe('Clear date');

    clear.click();
    await settle();

    expect(host.value()).toBe('');
    expect(root().querySelector<HTMLInputElement>('.date-input')?.value).toBe('');
    expect(root().querySelector('.date-clear')).toBeNull();
  });

  it('withholds the clear button from a read-only field', async () => {
    host.mode.set('dropdown');
    host.showClear.set(true);
    host.value.set('2026-07-14');
    await settle();
    expect(root().querySelector('.date-clear')).not.toBeNull();

    // A control the user cannot edit must not offer a control that edits it.
    host.readonly.set(true);
    await settle();

    expect(root().querySelector('.date-clear')).toBeNull();
  });

  it('emits touch when focus leaves the whole control', async () => {
    input().focus();
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    input().blur();
    await settle();
    await Promise.resolve();
    expect(host.touchCount).toBe(1);
  });

  it('binds directly to a Signal Forms field', async () => {
    const formFixture = TestBed.createComponent(SignalFormDatePickerHost);
    await formFixture.whenStable();
    const formHost = formFixture.componentInstance;
    const formInput = (formFixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input',
    );
    if (!formInput) throw new Error('Signal Forms date input not rendered');

    formInput.value = '14/07/2026';
    formInput.dispatchEvent(new Event('input', { bubbles: true }));
    await formFixture.whenStable();

    expect(formHost.model().date).toBe('2026-07-14');
    expect(formHost.bookingForm.date().valid()).toBe(true);
    formFixture.destroy();
  });
});

describe('DatePicker copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'datePicker.previousMonth': 'customer.previousMonth' }),
      ],
    });
    const fixture = TestBed.createComponent(DatePickerHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { previousMonth: 'Back a month' } }, 'en', {
      merge: true,
    });
    await fixture.whenStable();
    await firstValueFrom(transloco.load('datePicker/en'));
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Back a month"]')).not.toBeNull();
    fixture.destroy();
  });
});

// Regression: the grid always marks one day active, and its ring read as a preselection.
describe('DatePicker day ring', () => {
  it('follows keyboard focus rather than the active day', () => {
    const styles = readFileSync('src/date-picker.scss', 'utf8');

    expect(styles).not.toContain("[data-active='true']");
    expect(styles).toContain('&:focus-visible');
  });
});

@Component({
  imports: [DatePicker],
  template: `
    <lib-date-picker
      mode="inline"
      locale="en-GB"
      today="2026-07-13"
      startAt="2026-07-13"
      [availability]="availability()"
    />
  `,
})
class AvailabilityHost {
  readonly availability = signal<DayAvailability>({ '2026-07-14': 0.6, '2026-07-16': 0.1 });
}

describe('DatePicker availability', () => {
  let fixture: ComponentFixture<AvailabilityHost>;

  function day(date: string): HTMLElement {
    const cell = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-date="${date}"]`,
    );
    if (!cell) throw new Error(`${date} not rendered`);
    return cell;
  }

  function legend(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.date-legend');
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    });
    fixture = TestBed.createComponent(AvailabilityHost);
    await fixture.whenStable();
    await firstValueFrom(TestBed.inject(TranslocoService).load('datePicker/en'));
    await fixture.whenStable();
  });

  it('tints each day by level and names the level', () => {
    expect(day('2026-07-14').getAttribute('data-availability')).toBe('high');
    expect(day('2026-07-14').getAttribute('aria-label')).toMatch(/, many free times$/);
    expect(day('2026-07-16').getAttribute('data-availability')).toBe('low');
    expect(day('2026-07-17').hasAttribute('data-availability')).toBe(false);
    expect(day('2026-07-17').getAttribute('aria-label')).not.toContain('free times');
  });

  it('shows a legend hidden from assistive technology only while a day has a level', async () => {
    expect(legend()?.getAttribute('aria-hidden')).toBe('true');

    fixture.componentInstance.availability.set({});
    await fixture.whenStable();

    expect(legend()).toBeNull();
  });
});
