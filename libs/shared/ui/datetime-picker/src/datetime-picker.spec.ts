import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { firstValueFrom } from 'rxjs';
import { DatetimePicker } from './datetime-picker';

@Component({
  imports: [DatetimePicker],
  template: `
    <lib-datetime-picker
      [(value)]="value"
      [(timeEnabled)]="timeEnabled"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [iconPosition]="iconPosition()"
      ariaLabel="Starts"
    />
  `,
})
class Host {
  readonly value = signal<Date | null>(new Date(2026, 0, 5, 14, 30));
  readonly timeEnabled = signal(true);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly iconPosition = signal<'start' | 'end'>('start');
}

describe('DatetimePicker', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
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
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('displays the local date and time through one field', () => {
    const input = element().querySelector<HTMLInputElement>('.datetime-input');
    if (input == null) throw new Error('Datetime input not rendered');
    expect(input.value).toContain('14:30');
    expect(input.getAttribute('aria-label')).toBe('Starts');
  });

  it('accepts a typed localized date and optional time separated by a comma', () => {
    const input = element().querySelector<HTMLInputElement>('.datetime-input');
    if (input == null) throw new Error('Datetime input not rendered');
    input.value = '1/6/2026, 09:30';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(host.value()).toEqual(new Date(2026, 0, 6, 9, 30));
    expect(host.timeEnabled()).toBe(true);
  });

  it('accepts a date without time and returns local midnight', () => {
    const input = element().querySelector<HTMLInputElement>('.datetime-input');
    if (input == null) throw new Error('Datetime input not rendered');
    input.value = '1/6/2026';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(host.value()).toEqual(new Date(2026, 0, 6));
    expect(host.timeEnabled()).toBe(false);
  });

  it('places the calendar button at the end when requested', () => {
    host.iconPosition.set('end');
    fixture.detectChanges();
    const picker = element().querySelector('lib-datetime-picker');
    expect(picker?.getAttribute('data-icon-position')).toBe('end');
  });

  it('keeps the time switch enabled before a date is selected', async () => {
    host.value.set(null);
    host.timeEnabled.set(false);
    fixture.detectChanges();
    const open = element().querySelector<HTMLButtonElement>('.datetime-calendar-button');
    if (open == null) throw new Error('Datetime calendar button not rendered');
    open.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const toggle = document.body.querySelector<HTMLInputElement>('.datetime-time-switch input');
    if (toggle == null) throw new Error('Time switch not rendered');
    expect(toggle.disabled).toBe(false);
    toggle.click();
    fixture.detectChanges();
    expect(host.timeEnabled()).toBe(false);
    expect(document.body.querySelector('lib-time-picker[data-mode="dropdown"]')).not.toBeNull();
    expect(document.body.querySelectorAll('.time-clock-mark')).toHaveLength(12);
    const apply = document.body.querySelector<HTMLButtonElement>(
      '.datetime-actions button:last-child',
    );
    if (apply == null) throw new Error('Apply button not rendered');
    apply.click();
    fixture.detectChanges();
    expect(host.timeEnabled()).toBe(true);
  });

  it('discards popover edits on cancel', async () => {
    const open = element().querySelector<HTMLButtonElement>('.datetime-calendar-button');
    if (open == null) throw new Error('Datetime calendar button not rendered');
    open.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const toggle = document.body.querySelector<HTMLInputElement>('.datetime-time-switch input');
    const cancel = document.body.querySelector<HTMLButtonElement>('.datetime-actions button');
    if (toggle == null || cancel == null) throw new Error('Datetime actions not rendered');
    toggle.click();
    fixture.detectChanges();
    cancel.click();
    fixture.detectChanges();
    expect(host.timeEnabled()).toBe(true);
    expect(host.value()).toEqual(new Date(2026, 0, 5, 14, 30));
  });

  it('selects the current instant and can reset only its time to midnight', async () => {
    const open = element().querySelector<HTMLButtonElement>('.datetime-calendar-button');
    if (open == null) throw new Error('Datetime calendar button not rendered');
    open.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const datePicker = document.body.querySelector('lib-date-picker');
    const nowButton = document.body.querySelector<HTMLButtonElement>('.date-now-button');
    if (nowButton == null) throw new Error('Now button not rendered');
    expect(datePicker?.hasAttribute('data-borderless')).toBe(true);
    const before = new Date();
    nowButton.click();
    fixture.detectChanges();
    const after = new Date();
    const timeInput = document.body.querySelector<HTMLInputElement>('.time-input');
    const midnight = document.body.querySelector<HTMLButtonElement>('.datetime-midnight-button');
    if (timeInput == null || midnight == null) throw new Error('Time controls not rendered');
    const time = (date: Date): string =>
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    expect([time(before), time(after)]).toContain(timeInput.value);
    midnight.click();
    fixture.detectChanges();
    expect(timeInput.value).toBe('00:00');
    expect(host.value()).toEqual(new Date(2026, 0, 5, 14, 30));
  });

  it('withholds clear while disabled or read-only', () => {
    expect(element().querySelector('.datetime-clear')).not.toBeNull();
    host.readonly.set(true);
    fixture.detectChanges();
    expect(element().querySelector('.datetime-clear')).toBeNull();
    host.readonly.set(false);
    host.disabled.set(true);
    fixture.detectChanges();
    expect(element().querySelector('.datetime-clear')).toBeNull();
  });

  it('clears both the value and optional-time state', () => {
    const clear = element().querySelector<HTMLButtonElement>('.datetime-clear');
    if (clear == null) throw new Error('Datetime clear button not rendered');
    clear.click();
    fixture.detectChanges();
    expect(host.value()).toBeNull();
    expect(host.timeEnabled()).toBe(false);
  });
});

describe('DatetimePicker copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'datetimePicker.open': 'customer.open' }),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { open: 'Pick a day and time' } }, 'en', {
      merge: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('datetimePicker/en'));
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '.datetime-calendar-button',
    );
    expect(button?.getAttribute('aria-label')).toBe('Pick a day and time');
  });
});
