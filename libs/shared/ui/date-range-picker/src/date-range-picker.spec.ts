import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { FormField, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';

import {
  checkDateRange,
  countRangeDays,
  DATE_RANGE_PRESETS,
  EMPTY_DATE_RANGE,
  isoWeekdayOf,
  resolveDateRangePreset,
} from './core/date-range';
import { DateRangePicker } from './date-range-picker';
import type { DateRangePreset, DateRangeValue } from './date-range-picker.types';
import { validateDateRange } from './validate-date-range';

const TODAY = '2026-10-04';

const translocoConfig = {
  config: {
    availableLangs: ['el', 'en'],
    defaultLang: 'en',
    fallbackLang: 'en',
    missingHandler: { useFallbackTranslation: true },
  },
};

describe('date range core', () => {
  it('counts both ends and refuses a reversed range', () => {
    expect(countRangeDays('2026-09-01', '2026-09-30')).toBe(30);
    expect(countRangeDays('2026-09-01', '2026-09-01')).toBe(1);
    expect(countRangeDays('2026-09-02', '2026-09-01')).toBe(0);
    expect(countRangeDays('', '2026-09-01')).toBe(0);
  });

  it('reads ISO weekdays', () => {
    expect(isoWeekdayOf('2024-01-01')).toBe(1);
    expect(isoWeekdayOf('2024-01-07')).toBe(7);
    expect(isoWeekdayOf('1969-12-29')).toBe(1);
  });

  it('names the first rule a range breaks', () => {
    const limits = { min: '2026-01-01', max: '2026-12-31', maxDays: 10 };
    expect(checkDateRange({ from: '2026-09-01', to: '2026-09-10' }, limits)).toBeUndefined();
    expect(checkDateRange({ from: '2026-09-01', to: 'x' }, limits)).toBe('dateFormat');
    expect(checkDateRange({ from: '2025-12-31', to: '2026-01-02' }, limits)).toBe(
      'dateUnavailable',
    );
    expect(checkDateRange({ from: '2026-09-10', to: '2026-09-01' }, limits)).toBe('rangeOrder');
    expect(checkDateRange({ from: '2026-09-01', to: '2026-09-11' }, limits)).toBe('rangeTooLong');
  });

  it('resolves the built-in presets from today', () => {
    const resolve = (id: string, today = TODAY): DateRangeValue | undefined =>
      resolveDateRangePreset(DATE_RANGE_PRESETS, id, today);
    expect(resolve('last7')).toEqual({ preset: 'last7', from: '2026-09-28', to: TODAY });
    expect(resolve('last30')).toEqual({ preset: 'last30', from: '2026-09-05', to: TODAY });
    expect(resolve('thisMonth')).toEqual({ preset: 'thisMonth', from: '2026-10-01', to: TODAY });
    expect(resolve('lastMonth')).toEqual({
      preset: 'lastMonth',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(resolve('thisYear')).toEqual({ preset: 'thisYear', from: '2026-01-01', to: TODAY });
    expect(resolve('last12Months')).toEqual({
      preset: 'last12Months',
      from: '2025-10-05',
      to: TODAY,
    });
    // A leap day has no twin a year earlier, so the range starts on 1 March.
    expect(resolve('last12Months', '2028-02-29')?.from).toBe('2027-03-01');
    expect(resolve('lastMonth', '2026-01-15')).toEqual({
      preset: 'lastMonth',
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(resolve('unknown')).toBeUndefined();
  });
});

@Component({
  imports: [DateRangePicker],
  template: `
    <lib-date-range-picker
      [(value)]="value"
      [presets]="presets()"
      [maxDays]="maxDays()"
      [maxDate]="maxDate()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [fromAriaLabel]="fromLabel()"
      locale="en-GB"
      today="2026-10-04"
      (touch)="touches.set(touches() + 1)"
    />
  `,
})
class Host {
  readonly value = signal<DateRangeValue>(EMPTY_DATE_RANGE);
  readonly presets = signal<readonly DateRangePreset[]>(DATE_RANGE_PRESETS);
  readonly maxDays = signal<number | undefined>(undefined);
  readonly maxDate = signal<string | undefined>(undefined);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly fromLabel = signal('');
  readonly touches = signal(0);
}

describe('DateRangePicker', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let overlay: HTMLElement;

  function query(root: ParentNode, selector: string): HTMLElement {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`${selector} not rendered`);
    return element;
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const inputs = (): HTMLInputElement[] =>
    Array.from(element().querySelectorAll<HTMLInputElement>('.range-input'));
  const toggle = (): HTMLButtonElement => {
    const found = query(element(), '.range-toggle');
    if (!(found instanceof HTMLButtonElement)) throw new Error('toggle not rendered');
    return found;
  };
  const day = (date: string): HTMLElement => query(overlay, `[data-date="${date}"]`);
  const labelled = (label: string): HTMLButtonElement => {
    const found = query(overlay, `button[aria-label="${label}"]`);
    if (!(found instanceof HTMLButtonElement)) throw new Error(`${label} button not rendered`);
    return found;
  };
  const button = (text: string): HTMLButtonElement => {
    const found = Array.from(overlay.querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === text,
    );
    if (!found) throw new Error(`${text} button not rendered`);
    return found;
  };

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function type(from: string, to: string): Promise<void> {
    const [fromInput, toInput] = inputs();
    fromInput.value = from;
    fromInput.dispatchEvent(new Event('input'));
    toInput.value = to;
    toInput.dispatchEvent(new Event('input'));
    toInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
  }

  async function open(): Promise<void> {
    toggle().click();
    await settle();
  }

  async function press(key: string): Promise<void> {
    const target = document.activeElement;
    if (!target) throw new Error('nothing focused');
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await settle();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideTransloco(translocoConfig)] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('dateRangePicker/en'));
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('typed dates', () => {
    it('writes a typed range on Enter', async () => {
      await type('01/09/2026', '30/09/2026');
      expect(host.value()).toEqual({ preset: null, from: '2026-09-01', to: '2026-09-30' });
    });

    it('shows the value in the locale format', async () => {
      host.value.set({ preset: null, from: '2026-09-01', to: '2026-09-30' });
      await settle();
      expect(inputs().map((input) => input.value)).toEqual(['01/09/2026', '30/09/2026']);
    });

    it('empties the value and keeps the text when a date is not real', async () => {
      host.value.set({ preset: null, from: '2026-09-01', to: '2026-09-30' });
      await settle();
      await type('31/02/2026', '30/09/2026');
      expect(host.value()).toEqual(EMPTY_DATE_RANGE);
      expect(inputs()[0].value).toBe('31/02/2026');
      expect(inputs()[0].getAttribute('aria-invalid')).toBe('true');
      expect(query(element(), '[role="alert"]').textContent).toContain('valid dates');
    });

    it('drops a refused entry when the consumer sets a value', async () => {
      await type('31/02/2026', '30/09/2026');
      host.value.set({ preset: 'last7', from: '2026-09-28', to: TODAY });
      await settle();
      expect(inputs().map((input) => input.value)).toEqual(['28/09/2026', '04/10/2026']);
      expect(element().querySelector('[role="alert"]')).toBeNull();
    });

    it('refuses a reversed range', async () => {
      await type('30/09/2026', '01/09/2026');
      expect(host.value()).toEqual(EMPTY_DATE_RANGE);
      expect(query(element(), '[role="alert"]').textContent).toContain('cannot be before');
    });

    it('refuses a range longer than maxDays and names the limit', async () => {
      host.maxDays.set(10);
      await settle();
      await type('01/09/2026', '30/09/2026');
      expect(host.value()).toEqual(EMPTY_DATE_RANGE);
      expect(query(element(), '[role="alert"]').textContent).toContain('at most 10 days');
    });

    it('keeps the preset when the same dates are retyped', async () => {
      host.value.set({ preset: 'last7', from: '2026-09-28', to: TODAY });
      await settle();
      await type('28/09/2026', '04/10/2026');
      expect(host.value().preset).toBe('last7');
    });

    it('describes the fields by the error', async () => {
      await type('nonsense', '30/09/2026');
      const alert = query(element(), '[role="alert"]');
      expect(inputs()[0].getAttribute('aria-describedby')).toBe(alert.id);
    });
  });

  describe('panel', () => {
    it('opens a dialog on the toggle and focuses today', async () => {
      await open();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(query(overlay, '[role="dialog"]').getAttribute('aria-label')).toBe(
        'Choose a date range',
      );
      expect(document.activeElement?.getAttribute('data-date')).toBe(TODAY);
      // The range ends in the last column: September and October.
      expect(overlay.querySelectorAll('[role="grid"]')).toHaveLength(2);
    });

    it('writes two clicks only on Apply', async () => {
      await open();
      day('2026-09-03').click();
      await settle();
      expect(query(overlay, '.range-summary').textContent).toContain('Choose the last day');
      day('2026-09-10').click();
      await settle();
      expect(host.value()).toEqual(EMPTY_DATE_RANGE);
      expect(query(overlay, '.range-summary').textContent).toContain('8 days');
      expect(day('2026-09-05').getAttribute('aria-selected')).toBe('true');

      button('Apply').click();
      await settle();
      expect(host.value()).toEqual({ preset: null, from: '2026-09-03', to: '2026-09-10' });
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('orders a second click before the first', async () => {
      await open();
      day('2026-09-20').click();
      await settle();
      day('2026-09-12').click();
      await settle();
      button('Apply').click();
      await settle();
      expect(host.value()).toEqual({ preset: null, from: '2026-09-12', to: '2026-09-20' });
    });

    it('discards the draft on Cancel', async () => {
      host.value.set({ preset: 'last7', from: '2026-09-28', to: TODAY });
      await settle();
      await open();
      day('2026-09-01').click();
      await settle();
      day('2026-09-02').click();
      await settle();
      button('Cancel').click();
      await settle();
      expect(host.value()).toEqual({ preset: 'last7', from: '2026-09-28', to: TODAY });
    });

    it('keeps Apply disabled until the range has both ends', async () => {
      await open();
      expect(button('Apply').disabled).toBe(true);
      day('2026-09-03').click();
      await settle();
      expect(button('Apply').disabled).toBe(true);
    });

    it('disables the days a first click cannot reach within maxDays', async () => {
      host.maxDays.set(5);
      await settle();
      await open();
      day('2026-09-10').click();
      await settle();
      expect(day('2026-09-14').getAttribute('aria-disabled')).toBeNull();
      expect(day('2026-09-15').getAttribute('aria-disabled')).toBe('true');
      expect(day('2026-09-06').getAttribute('aria-disabled')).toBeNull();
      expect(day('2026-09-05').getAttribute('aria-disabled')).toBe('true');
      day('2026-09-20').click();
      await settle();
      expect(query(overlay, '.range-summary').textContent).toContain('Choose the last day');
    });

    it('applies a preset at once and closes', async () => {
      await open();
      button('Last 7 days').click();
      await settle();
      expect(host.value()).toEqual({ preset: 'last7', from: '2026-09-28', to: TODAY });
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('marks the preset in force and disables one past maxDays', async () => {
      host.value.set({ preset: 'last30', from: '2026-09-05', to: TODAY });
      host.maxDays.set(31);
      await settle();
      await open();
      expect(button('Last 30 days').getAttribute('aria-pressed')).toBe('true');
      expect(button('Last 7 days').getAttribute('aria-pressed')).toBe('false');
      expect(button('Last 90 days').disabled).toBe(true);
    });

    it('leaves out the preset column when there are no presets', async () => {
      host.presets.set([]);
      await settle();
      await open();
      expect(overlay.querySelector('.range-presets')).toBeNull();
    });

    it('moves by day and month on the keyboard and picks with Enter', async () => {
      await open();
      await press('ArrowRight');
      expect(document.activeElement?.getAttribute('data-date')).toBe('2026-10-05');
      await press('Enter');
      expect(query(overlay, '.range-summary').textContent).toContain('Choose the last day');
      await press('ArrowUp');
      expect(document.activeElement?.getAttribute('data-date')).toBe('2026-09-28');
      await press('Enter');
      expect(query(overlay, '.range-summary').textContent).toContain('8 days');
      await press('PageUp');
      expect(document.activeElement?.getAttribute('data-date')).toBe('2026-08-28');
      // August was out of view, so the months moved to show it.
      expect(overlay.querySelector('[data-date="2026-10-01"]')).toBeNull();
    });

    it('keeps the month buttons through a month change', async () => {
      await open();
      const next = query(overlay, '[aria-label="Next month"]');
      next.focus();
      next.click();
      await settle();
      expect(next.isConnected).toBe(true);
      expect(document.activeElement).toBe(next);
      expect(
        Array.from(overlay.querySelectorAll('.range-month-heading')).map((h) =>
          h.textContent.trim(),
        ),
      ).toEqual(['October 2026', 'November 2026']);
    });

    it('stays open when a re-render removes the focused day', async () => {
      await open();
      const focused = day(TODAY);
      // Chrome fires focusout for a focused element that is removed. jsdom does not.
      focused.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      focused.remove();
      // The check runs in a microtask, and a close it makes renders one pass later.
      await settle();
      await settle();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
    });

    it('shows each date once, even where two months meet', async () => {
      await open();
      expect(overlay.querySelectorAll('[data-date="2026-09-30"]')).toHaveLength(1);
      expect(overlay.querySelectorAll('[data-date="2026-10-01"]')).toHaveLength(1);
    });

    it('closes on Escape and returns focus to the toggle', async () => {
      await open();
      query(overlay, '[role="dialog"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await settle();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle());
    });
  });

  describe('drag', () => {
    // jsdom has no layout, so the picker's hit test falls back to the event target.
    function pointer(type: string, target: EventTarget): void {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
    }

    async function drag(from: string, ...over: string[]): Promise<void> {
      pointer('pointerdown', day(from));
      for (const date of over) pointer('pointermove', day(date));
      pointer('pointerup', document);
      // Touch fires the click on the first day after the release.
      day(from).click();
      await settle();
    }

    it('selects the days between press and release', async () => {
      await open();
      await drag('2026-09-03', '2026-09-06', '2026-09-10');
      expect(query(overlay, '.range-summary').textContent).toContain('8 days');
      button('Apply').click();
      await settle();
      expect(host.value()).toEqual({ preset: null, from: '2026-09-03', to: '2026-09-10' });
    });

    it('orders a drag that runs backwards', async () => {
      await open();
      await drag('2026-09-20', '2026-09-12');
      button('Apply').click();
      await settle();
      expect(host.value()).toEqual({ preset: null, from: '2026-09-12', to: '2026-09-20' });
    });

    it('keeps a press and release on one day a click', async () => {
      await open();
      await drag('2026-09-03');
      expect(query(overlay, '.range-summary').textContent).toContain('Choose the last day');
      day('2026-09-05').click();
      await settle();
      expect(query(overlay, '.range-summary').textContent).toContain('3 days');
    });

    it('stops at the last day within maxDays', async () => {
      host.maxDays.set(5);
      await settle();
      await open();
      await drag('2026-09-10', '2026-09-12', '2026-09-25');
      button('Apply').click();
      await settle();
      expect(host.value()).toEqual({ preset: null, from: '2026-09-10', to: '2026-09-12' });
    });

    it('lets a later click without a press through after a mouse drag', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        await open();
        // A mouse drag fires its click on the row, so no day consumes the suppression.
        pointer('pointerdown', day('2026-09-03'));
        pointer('pointermove', day('2026-09-10'));
        pointer('pointerup', document);
        await settle();
        vi.setSystemTime(Date.now() + 1000);
        // A screen reader clicks without a press.
        day('2026-09-15').click();
        await settle();
        expect(query(overlay, '.range-summary').textContent).toContain('Choose the last day');
      } finally {
        vi.useRealTimers();
      }
    });

    it('does nothing when read-only', async () => {
      host.readonly.set(true);
      await settle();
      await open();
      await drag('2026-09-03', '2026-09-10');
      expect(query(overlay, '.range-summary').textContent.trim()).toBe('');
    });
  });

  describe('month grid', () => {
    const headings = (): string[] =>
      Array.from(overlay.querySelectorAll('.range-days .range-month-heading')).map((heading) =>
        heading.textContent.trim(),
      );
    const heading = (index: number): HTMLElement =>
      query(overlay, `[data-heading-index="${String(index)}"]`);
    const month = (value: string): HTMLButtonElement => {
      const found = query(overlay, `[data-month="${value}"]`);
      if (!(found instanceof HTMLButtonElement)) throw new Error(`${value} not rendered`);
      return found;
    };

    it('opens on the heading with the shown month marked and focused', async () => {
      await open();
      heading(0).click();
      await settle();
      expect(overlay.querySelectorAll('.range-month-option')).toHaveLength(12);
      expect(month('2026-09').getAttribute('aria-pressed')).toBe('true');
      expect(document.activeElement).toBe(month('2026-09'));
      expect(query(overlay, '.range-days').hasAttribute('inert')).toBe(true);
    });

    it('moves by year and puts the picked month in the clicked column', async () => {
      await open();
      heading(0).click();
      await settle();
      labelled('Next year').click();
      await settle();
      month('2027-03').click();
      await settle();
      expect(headings()).toEqual(['March 2027', 'April 2027']);
      expect(document.activeElement).toBe(heading(0));

      heading(1).click();
      await settle();
      labelled('Previous year').click();
      await settle();
      labelled('Previous year').click();
      await settle();
      month('2025-01').click();
      await settle();
      expect(headings()).toEqual(['December 2024', 'January 2025']);
    });

    it('keeps a first click waiting across a year jump', async () => {
      await open();
      day('2026-09-10').click();
      await settle();
      heading(1).click();
      await settle();
      labelled('Next year').click();
      await settle();
      month('2027-03').click();
      await settle();
      day('2027-03-05').click();
      await settle();
      button('Apply').click();
      await settle();
      expect(host.value()).toEqual({ preset: null, from: '2026-09-10', to: '2027-03-05' });
    });

    it('moves through months with the arrows, across the year edge', async () => {
      await open();
      heading(0).click();
      await settle();
      month('2026-09').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await settle();
      expect(document.activeElement).toBe(month('2026-12'));
      month('2026-12').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      await settle();
      expect(document.activeElement).toBe(month('2027-01'));
    });

    it('disables the months and years past maxDate', async () => {
      host.maxDate.set('2026-11-15');
      await settle();
      await open();
      heading(0).click();
      await settle();
      expect(month('2026-11').disabled).toBe(false);
      expect(month('2026-12').disabled).toBe(true);
      expect(labelled('Next year').disabled).toBe(true);
    });

    it('leaves the month grid on Escape and keeps the panel open', async () => {
      await open();
      heading(0).click();
      await settle();
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await settle();
      expect(overlay.querySelector('.range-month-option')).toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(heading(0));
    });
  });

  describe('state', () => {
    it('disables every field and the toggle', async () => {
      host.disabled.set(true);
      await settle();
      expect(inputs().every((input) => input.disabled)).toBe(true);
      expect(toggle().disabled).toBe(true);
      expect(element().querySelector('lib-date-range-picker')?.hasAttribute('data-disabled')).toBe(
        true,
      );
    });

    it('keeps the calendar readable but offers no edit when read-only', async () => {
      host.readonly.set(true);
      await settle();
      expect(inputs().every((input) => input.readOnly)).toBe(true);
      await open();
      expect(
        Array.from(overlay.querySelectorAll('button')).map((b) => b.textContent.trim()),
      ).not.toContain('Apply');
      expect(button('Last 7 days').disabled).toBe(true);
      expect(day('2026-09-10').getAttribute('aria-disabled')).toBe('true');
      day('2026-09-10').click();
      await settle();
      expect(query(overlay, '.range-summary').textContent.trim()).toBe('');
    });

    it('names the fields, and a consumer label wins', async () => {
      expect(inputs().map((input) => input.getAttribute('aria-label'))).toEqual(['From', 'To']);
      expect(query(element(), '[role="group"]').getAttribute('aria-label')).toBe('Date range');
      host.fromLabel.set('Start');
      await settle();
      expect(inputs()[0].getAttribute('aria-label')).toBe('Start');
    });

    it('emits touch once focus leaves the control', async () => {
      inputs()[0].focus();
      inputs()[1].focus();
      await settle();
      // Moving between its own fields is not leaving.
      expect(host.touches()).toBe(0);
      inputs()[1].blur();
      await settle();
      expect(host.touches()).toBe(1);
    });
  });
});

describe('DateRangePicker copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco(translocoConfig),
        provideUiCopy({ 'dateRangePicker.from': 'customer.from' }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { from: 'Arrival' } }, 'en', { merge: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('dateRangePicker/en'));
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('.range-input');
    expect(input?.getAttribute('aria-label')).toBe('Arrival');
  });
});

@Component({
  imports: [DateRangePicker, FormField],
  template: `<lib-date-range-picker
    [formField]="filters.range"
    locale="en-GB"
    today="2026-10-04"
  />`,
})
class FormHost {
  readonly model = signal({ range: EMPTY_DATE_RANGE });
  readonly filters = form(this.model, (filters) => {
    validateDateRange(filters.range, { maxDays: 31 });
  });
}

describe('DateRangePicker with Signal Forms', () => {
  it('round-trips the value and validates it', async () => {
    TestBed.configureTestingModule({ providers: [provideTransloco(translocoConfig)] });
    const fixture = TestBed.createComponent(FormHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const inputs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('.range-input'),
    );

    inputs[0].value = '01/09/2026';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = '10/09/2026';
    inputs[1].dispatchEvent(new Event('input'));
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(host.model().range).toEqual({ preset: null, from: '2026-09-01', to: '2026-09-10' });

    host.model.set({ range: { preset: null, from: '2026-01-01', to: '2026-03-01' } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(inputs.map((input) => input.value)).toEqual(['01/01/2026', '01/03/2026']);
    expect(
      host.filters
        .range()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['rangeTooLong']);
    fixture.destroy();
  });
});
