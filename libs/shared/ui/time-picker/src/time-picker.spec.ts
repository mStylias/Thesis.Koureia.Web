import { readFileSync } from 'node:fs';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { TimePicker } from './time-picker';
import { TimePickerMode, TimeRange } from './time-picker.types';
import { createTimeSlots, isTimeAllowed, normalizeTime } from './time-picker.utils';

describe('time utilities', () => {
  it('normalizes common typed time formats', () => {
    expect(normalizeTime('9')).toBe('09:00');
    expect(normalizeTime('930')).toBe('09:30');
    expect(normalizeTime('9:05')).toBe('09:05');
    expect(normalizeTime('24:00')).toBeUndefined();
  });

  it('generates interval slots within the configured bounds', () => {
    expect(createTimeSlots(30, { min: '09:00', max: '10:00' }).map((slot) => slot.value)).toEqual([
      '09:00',
      '09:30',
      '10:00',
    ]);
  });

  it('floors a sub-minute interval to one minute instead of overflowing', () => {
    // Anything that floors to 0 used to make the array length Infinity.
    expect(() => createTimeSlots(0.5)).not.toThrow();
    expect(createTimeSlots(0.5, { min: '09:00', max: '09:02' }).map((slot) => slot.value)).toEqual([
      '09:00',
      '09:01',
      '09:02',
    ]);
  });

  it('falls back to the default step for a non-positive interval', () => {
    expect(createTimeSlots(0, { min: '09:00', max: '10:00' }).map((slot) => slot.value)).toEqual([
      '09:00',
      '09:30',
      '10:00',
    ]);
  });

  it('applies ranges, exact exclusions, and exact valid values', () => {
    const constraints = {
      min: '09:00',
      max: '18:00',
      includedRanges: [{ start: '09:00', end: '17:00' }],
      excludedRanges: [{ start: '13:00', end: '14:00' }],
      excludedTimes: ['10:30'],
    } as const;

    expect(isTimeAllowed('09:15', constraints)).toBe(true);
    expect(isTimeAllowed('10:30', constraints)).toBe(false);
    expect(isTimeAllowed('13:30', constraints)).toBe(false);
    expect(isTimeAllowed('17:00', constraints)).toBe(false);
    expect(isTimeAllowed('09:20', { validTimes: ['09:00', '09:30'] })).toBe(false);
  });

  it('supports overnight included ranges', () => {
    const constraints = {
      includedRanges: [{ start: '22:00', end: '02:00' }],
    } as const;
    expect(isTimeAllowed('23:30', constraints)).toBe(true);
    expect(isTimeAllowed('01:30', constraints)).toBe(true);
    expect(isTimeAllowed('12:00', constraints)).toBe(false);
  });
});

@Component({
  imports: [TimePicker],
  template: `
    <lib-time-picker
      [(value)]="value"
      [mode]="mode()"
      [interval]="30"
      min="09:00"
      max="11:00"
      [excludedRanges]="excludedRanges"
      [excludedDisplay]="excludedDisplay()"
      [readonly]="readonly()"
      showClear
      ariaLabel="Appointment time"
      (touch)="touchCount = touchCount + 1"
    />
  `,
})
class TimePickerHost {
  readonly value = signal('');
  readonly mode = signal<TimePickerMode>('dropdown');
  readonly excludedDisplay = signal<'disabled' | 'hidden'>('disabled');
  readonly readonly = signal(false);
  readonly excludedRanges: readonly TimeRange[] = [{ start: '10:00', end: '10:30' }];
  touchCount = 0;
}

describe('TimePicker', () => {
  let fixture: ComponentFixture<TimePickerHost>;
  let host: TimePickerHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'lib-time-picker',
    );
    if (!element) {
      throw new Error('time picker not rendered');
    }
    return element;
  }

  function input(): HTMLInputElement {
    const element = root().querySelector<HTMLInputElement>('input');
    if (!element) {
      throw new Error('time input not rendered');
    }
    return element;
  }

  // The dropdown renders in a CDK overlay, which jsdom puts in the global container.
  function options(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function open(): Promise<void> {
    input().focus();
    input().click();
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
    fixture = TestBed.createComponent(TimePickerHost);
    host = fixture.componentInstance;
    await settle();
    // The lazy scope loads through a dynamic import; without this the
    // messages render as their keys.
    await firstValueFrom(TestBed.inject(TranslocoService).load('timePicker/en'));
    await settle();
  });

  it('opens an editable combobox with generated slots', async () => {
    await open();

    expect(input().getAttribute('role')).toBe('combobox');
    expect(options().map((option) => option.textContent.trim())).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
    ]);
    expect(options()[2].getAttribute('aria-disabled')).toBe('true');
  });

  it('selects an available option and exposes the filled contract', async () => {
    await open();
    options()[1].click();
    await settle();

    expect(host.value()).toBe('09:30');
    expect(input().value).toBe('09:30');
    expect(root().hasAttribute('data-filled')).toBe(true);
  });

  // Regression: an absolutely positioned panel grew the scroll area of the dialog it sat in.
  it('renders the dropdown in an overlay pane, outside the scroll container', async () => {
    await open();

    expect(document.querySelector('.cdk-overlay-pane .time-panel')).not.toBeNull();
  });

  // Regression: the press moved focus off the input, the combobox closed on its own timer, and
  // the click then opened it again.
  it('keeps the dropdown closed when the chevron closes it', async () => {
    await open();
    const toggle = root().querySelector<HTMLButtonElement>('.time-toggle');
    if (!toggle) {
      throw new Error('time toggle not rendered');
    }

    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    toggle.dispatchEvent(press);
    toggle.click();
    await settle();
    await new Promise((resolve) => setTimeout(resolve));
    await settle();

    expect(press.defaultPrevented).toBe(true);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input());
  });

  it('normalizes a typed value on blur', async () => {
    input().value = '945';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();

    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();

    expect(host.value()).toBe('09:45');
    expect(input().value).toBe('09:45');
  });

  it('rejects typed excluded values and announces the error', async () => {
    input().value = '10:00';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();

    expect(host.value()).toBe('');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(root().querySelector('[role="alert"]')).not.toBeNull();
  });

  // Regression: the listbox always marks an option active, and its ring read as a preselection.
  it('marks no dropdown option until the keyboard moves through the list', async () => {
    await open();
    const list = document.querySelector('.time-list');

    expect(list?.hasAttribute('data-navigated')).toBe(false);
    expect(input().getAttribute('aria-activedescendant')).toBeNull();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();

    expect(list?.hasAttribute('data-navigated')).toBe(true);
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);
  });

  it('commits nothing on Enter while no option is shown active', async () => {
    await open();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();

    expect(host.value()).toBe('');
  });

  it('rings an inline tile only while it has keyboard focus', () => {
    const styles = readFileSync('src/time-picker.scss', 'utf8');

    expect(styles).not.toMatch(/^\s*&\[data-active='true'\]/m);
    expect(styles).toContain('&.time-tile:focus-visible');
  });

  it('renders the same choices as an inline listbox and can hide exclusions', async () => {
    host.mode.set('inline');
    host.excludedDisplay.set('hidden');
    await settle();

    expect(root().querySelector('[role="listbox"]')).not.toBeNull();
    expect(options().map((option) => option.textContent.trim())).toEqual([
      '09:00',
      '09:30',
      '10:30',
      '11:00',
    ]);

    options()[0].click();
    await settle();
    expect(host.value()).toBe('09:00');
  });

  it('distinguishes unparseable text from an unavailable time', async () => {
    input().value = 'noon';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();

    const message = root().querySelector('[role="alert"]')?.textContent ?? '';
    expect(message).toContain('valid time');
    expect(input().value).toBe('noon');
  });

  it('empties the model when typed text is rejected', async () => {
    host.value.set('09:30');
    await settle();

    input().value = '10:00';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();

    expect(host.value()).toBe('');
    expect(input().value).toBe('10:00');
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('available times');
  });

  it('withholds every edit affordance while read-only', async () => {
    host.value.set('09:30');
    host.readonly.set(true);
    await settle();

    expect(root().hasAttribute('data-readonly')).toBe(true);
    expect(input().readOnly).toBe(true);
    expect(root().querySelector('.time-icon-button:not(.time-toggle)')).toBeNull();

    await open();
    expect(options()).toHaveLength(0);

    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();
    expect(host.value()).toBe('09:30');
  });

  it('does not select a read-only inline slot', async () => {
    host.mode.set('inline');
    host.readonly.set(true);
    await settle();

    expect(options().every((option) => option.getAttribute('aria-disabled') === 'true')).toBe(true);

    options()[0].click();
    await settle();
    expect(host.value()).toBe('');
  });

  it('emits touch when focus leaves the control', async () => {
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();
    expect(host.touchCount).toBe(1);
  });
});

describe('TimePicker copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'timePicker.placeholder': 'customer.timePlaceholder' }),
      ],
    });
    const fixture = TestBed.createComponent(TimePickerHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { timePlaceholder: 'Pick a time' } }, 'en', {
      merge: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('timePicker/en'));
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('lib-time-picker input');
    expect(input?.getAttribute('placeholder')).toBe('Pick a time');
  });
});

@Component({
  imports: [TimePicker],
  template: `<lib-time-picker ariaLabel="Start" invalid touched [errors]="errors" />`,
})
class MessageHost {
  readonly errors = [{ kind: 'required', message: 'booking.startRequired' }];
}

describe('TimePicker messages', () => {
  it('translates the message a consumer gives as a key', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('timePicker/en'));
    transloco.setTranslation({ booking: { startRequired: 'Pick a start time.' } }, 'en', {
      merge: true,
    });
    const fixture = TestBed.createComponent(MessageHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent.trim()).toBe('Pick a start time.');
  });
});
