import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import {
  form,
  FormField,
  min as minValidator,
  required,
  type ValidationError,
} from '@angular/forms/signals';
import { InputNumber } from './input-number';
import { InputNumberButtonLayout, InputNumberMode } from './input-number.types';

@Component({
  imports: [InputNumber],
  template: `
    <lib-input-number
      [(value)]="value"
      [mode]="mode()"
      [currency]="currency()"
      [locale]="locale()"
      [prefix]="prefix()"
      [suffix]="suffix()"
      [valueFormatter]="valueFormatter()"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [showButtons]="showButtons()"
      [buttonLayout]="buttonLayout()"
      [showClear]="showClear()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [invalid]="invalid()"
      [frameless]="frameless()"
      [touched]="touched()"
      [required]="requiredField()"
      [errors]="errors()"
      [ariaLabel]="ariaLabel()"
      [ariaDescribedby]="ariaDescribedby()"
      (touch)="touchCount = touchCount + 1"
    />
  `,
})
class InputNumberHost {
  readonly value = signal<number | null>(null);
  readonly mode = signal<InputNumberMode>('decimal');
  readonly currency = signal('EUR');
  readonly locale = signal('en-US');
  readonly prefix = signal('');
  readonly suffix = signal('');
  readonly valueFormatter = signal<((value: number) => string) | undefined>(undefined);
  readonly min = signal<number | undefined>(undefined);
  readonly max = signal<number | undefined>(undefined);
  readonly step = signal(1);
  readonly showButtons = signal(false);
  readonly buttonLayout = signal<InputNumberButtonLayout>('stacked');
  readonly showClear = signal(false);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly invalid = signal(false);
  readonly frameless = signal(false);
  readonly touched = signal(false);
  readonly requiredField = signal(false);
  readonly errors = signal<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly ariaLabel = signal('');
  readonly ariaDescribedby = signal('');

  touchCount = 0;
}

@Component({
  imports: [InputNumber, FormField],
  template: `<lib-input-number [formField]="bookingForm.price" />`,
})
class SignalFormsHost {
  readonly model = signal({ price: 0 });
  readonly bookingForm = form(this.model, (path) => {
    required(path.price);
    minValidator(path.price, 5);
  });
}

/** A field that starts empty. Signal Forms holds an empty number as `null`, never `undefined`. */
@Component({
  imports: [InputNumber, FormField],
  template: `<lib-input-number [formField]="serviceForm.price" />`,
})
class NullableFormsHost {
  readonly model = signal<{ price: number | null }>({ price: null });
  readonly serviceForm = form(this.model, (path) => {
    required(path.price);
  });
}

describe('InputNumber', () => {
  let fixture: ComponentFixture<InputNumberHost>;
  let host: InputNumberHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-input-number');
    if (!element) {
      throw new Error('lib-input-number not rendered');
    }
    return element as HTMLElement;
  }

  function input(): HTMLInputElement {
    const element = root().querySelector('input');
    if (!element) {
      throw new Error('inner input not rendered');
    }
    return element;
  }

  function error(): HTMLElement | null {
    return root().querySelector<HTMLElement>('.number-error');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Focus, type raw text, and blur — the commit path. */
  async function enter(text: string): Promise<void> {
    input().dispatchEvent(new FocusEvent('focus'));
    await settle();
    input().value = text;
    input().dispatchEvent(new FocusEvent('blur'));
    await settle();
  }

  function keydown(key: string): void {
    input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
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
    fixture = TestBed.createComponent(InputNumberHost);
    host = fixture.componentInstance;
    // The first render is what registers this lib's scope loader — the
    // pipe carries it — so the scope can only be awaited afterwards.
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('inputNumber/en'));
    await settle();
  });

  it('commits typed text as a number on blur', async () => {
    await enter('42');
    expect(host.value()).toBe(42);
    expect(root().hasAttribute('data-filled')).toBe(true);
  });

  it('formats with grouping when blurred and shows plain text focused', async () => {
    host.value.set(1234567.5);
    await settle();
    expect(input().value).toBe('1,234,567.5');

    input().dispatchEvent(new FocusEvent('focus'));
    await settle();
    expect(input().value).toBe('1234567.5');
  });

  it('formats as currency', async () => {
    host.mode.set('currency');
    host.currency.set('USD');
    host.value.set(18);
    await settle();

    expect(input().value).toBe('$18.00');
  });

  it('parses locale decimal separators, e.g. el-GR commas', async () => {
    host.locale.set('el-GR');
    await settle();

    await enter('12,5');
    expect(host.value()).toBe(12.5);
    // el-GR renders the decimal back as a comma.
    expect(input().value).toBe('12,5');
  });

  it('wraps the value with prefix and suffix when blurred', async () => {
    host.suffix.set(' min');
    host.value.set(30);
    await settle();

    expect(input().value).toBe('30 min');

    await enter('45 min');
    expect(host.value()).toBe(45);
  });

  it('uses a custom formatter while keeping plain edit text', async () => {
    host.prefix.set('~');
    host.suffix.set(' away');
    host.valueFormatter.set((value) => `${String(value / 1000)} km`);
    host.value.set(2500);
    await settle();

    expect(input().value).toBe('~2.5 km away');
    expect(input().getAttribute('aria-valuetext')).toBe('~2.5 km away');

    input().dispatchEvent(new FocusEvent('focus'));
    await settle();
    expect(input().value).toBe('2500');
  });

  it('clamps commits and steps to min/max', async () => {
    host.min.set(0);
    host.max.set(10);
    await settle();

    await enter('99');
    expect(host.value()).toBe(10);

    keydown('ArrowUp');
    await settle();
    expect(host.value()).toBe(10);

    keydown('Home');
    await settle();
    expect(host.value()).toBe(0);

    keydown('End');
    await settle();
    expect(host.value()).toBe(10);
  });

  it('steps with the arrow keys and avoids float drift', async () => {
    host.step.set(0.1);
    host.value.set(0.2);
    await settle();

    keydown('ArrowUp');
    await settle();
    expect(host.value()).toBe(0.3);

    keydown('ArrowDown');
    keydown('ArrowDown');
    await settle();
    expect(host.value()).toBe(0.1);
  });

  it('falls back to a step of 1 for an unusable step', async () => {
    // The raw numberAttribute used to reach the arithmetic directly, so a
    // `0` froze the spinner and a NaN pushed NaN into the model.
    host.value.set(5);
    host.step.set(0);
    await settle();

    keydown('ArrowUp');
    await settle();
    expect(host.value()).toBe(6);

    host.step.set(Number.NaN);
    await settle();

    keydown('ArrowUp');
    await settle();
    expect(host.value()).toBe(7);

    host.step.set(-2);
    await settle();

    keydown('ArrowUp');
    await settle();
    expect(host.value()).toBe(8);
  });

  it('steps through the spinner buttons without committing focus', async () => {
    host.showButtons.set(true);
    host.value.set(5);
    await settle();

    const buttons = root().querySelectorAll<HTMLButtonElement>('.number-step');
    expect(buttons.length).toBe(2);

    buttons[0].click(); // up
    await settle();
    expect(host.value()).toBe(6);

    buttons[1].click(); // down
    await settle();
    expect(host.value()).toBe(5);
  });

  it('disables the matching button at the bounds', async () => {
    host.showButtons.set(true);
    host.max.set(10);
    host.value.set(10);
    await settle();

    const buttons = root().querySelectorAll<HTMLButtonElement>('.number-step');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
  });

  it('exposes the spinbutton pattern to assistive tech', async () => {
    host.min.set(0);
    host.max.set(100);
    host.suffix.set(' min');
    host.value.set(30);
    await settle();

    expect(input().getAttribute('role')).toBe('spinbutton');
    expect(input().getAttribute('aria-valuenow')).toBe('30');
    expect(input().getAttribute('aria-valuemin')).toBe('0');
    expect(input().getAttribute('aria-valuemax')).toBe('100');
    expect(input().getAttribute('aria-valuetext')).toBe('30 min');
  });

  it('clears through the × button and empties the value', async () => {
    host.showClear.set(true);
    host.value.set(18);
    await settle();

    const clear = root().querySelector<HTMLButtonElement>('.number-clear');
    expect(clear).not.toBeNull();

    clear?.click();
    await settle();

    expect(host.value()).toBeNull();
    expect(input().value).toBe('');
    expect(root().hasAttribute('data-filled')).toBe(false);
    expect(root().querySelector('.number-clear')).toBeNull();
  });

  it('empties the value when the text is cleared', async () => {
    host.value.set(18);
    await settle();

    await enter('');
    expect(host.value()).toBeNull();
    expect(input().value).toBe('');
  });

  it('reflects disabled and invalid states', async () => {
    host.disabled.set(true);
    host.invalid.set(true);
    await settle();

    expect(input().disabled).toBe(true);
    expect(root().hasAttribute('data-disabled')).toBe(true);
    expect(root().hasAttribute('data-invalid')).toBe(true);
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('reflects frameless, so a parent can draw the frame for a group', async () => {
    expect(root().hasAttribute('data-frameless')).toBe(false);

    host.frameless.set(true);
    host.invalid.set(true);
    await settle();

    expect(root().hasAttribute('data-frameless')).toBe(true);
    // Invalid still reports: a state the user must notice outranks the one
    // doubled hairline that frameless exists to remove.
    expect(root().hasAttribute('data-invalid')).toBe(true);
  });

  it('withholds every edit affordance while read-only', async () => {
    host.showClear.set(true);
    host.showButtons.set(true);
    host.value.set(18);
    host.readonly.set(true);
    await settle();

    expect(root().hasAttribute('data-readonly')).toBe(true);
    expect(input().readOnly).toBe(true);
    expect(root().querySelector('.number-clear')).toBeNull();
    expect(
      [...root().querySelectorAll<HTMLButtonElement>('.number-step')].every(
        (button) => button.disabled,
      ),
    ).toBe(true);

    // A stale click, or an arrow key, must not slip past the hidden UI.
    keydown('ArrowUp');
    await settle();
    expect(host.value()).toBe(18);

    // Nor may typed text commit on blur.
    input().value = '99';
    input().dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(host.value()).toBe(18);
  });

  it('withholds the clear button while disabled', async () => {
    host.showClear.set(true);
    host.value.set(18);
    host.disabled.set(true);
    await settle();

    expect(root().querySelector('.number-clear')).toBeNull();
    expect(host.value()).toBe(18);
  });

  it('exposes required as aria-required, never the native attribute', async () => {
    host.requiredField.set(true);
    await settle();

    expect(input().getAttribute('aria-required')).toBe('true');
    // The native attribute would let the browser block submit() with an
    // untranslated bubble.
    expect(input().hasAttribute('required')).toBe(false);
  });

  it('names the input from the translated scope, and lets ariaLabel win', async () => {
    expect(input().getAttribute('aria-label')).toBe('Number');

    host.ariaLabel.set('Amount');
    await settle();
    expect(input().getAttribute('aria-label')).toBe('Amount');
  });

  it('translates the clear button', async () => {
    host.showClear.set(true);
    host.value.set(18);
    await settle();

    expect(root().querySelector('.number-clear')?.getAttribute('aria-label')).toBe('Clear value');
  });

  it('holds the error back until the field is touched or blurred', async () => {
    host.errors.set([{ kind: 'min' }]);
    host.min.set(5);
    host.value.set(1);
    await settle();

    // A pre-filled invalid value must not accuse the user up front.
    expect(error()).toBeNull();
    expect(input().getAttribute('aria-describedby')).toBeNull();

    host.touched.set(true);
    await settle();

    expect(error()?.textContent.trim()).toBe('Enter 5 or more.');
    expect(error()?.getAttribute('role')).toBe('alert');
    expect(error()?.id).toMatch(/^lib-input-number-error-\d+$/);
    expect(input().getAttribute('aria-describedby')).toBe(error()?.id);
  });

  it('surfaces the error after a blur even when never marked touched', async () => {
    host.errors.set([{ kind: 'required' }]);
    await settle();

    root().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();

    expect(error()?.textContent.trim()).toBe('Enter a number.');
  });

  it('prefers a validator message over the translated fallback', async () => {
    host.errors.set([{ kind: 'min', message: 'At least €5' }]);
    host.touched.set(true);
    await settle();

    expect(error()?.textContent.trim()).toBe('At least €5');
  });

  it('composes aria-describedby instead of overwriting the consumer value', async () => {
    host.ariaDescribedby.set('price-hint');
    host.errors.set([{ kind: 'required' }]);
    host.touched.set(true);
    await settle();

    const describedBy = input().getAttribute('aria-describedby');
    expect(describedBy).toContain('price-hint');
    expect(describedBy).toContain(error()?.id ?? 'missing');
  });

  it('emits touch when focus leaves the component', async () => {
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await settle();

    expect(host.touchCount).toBe(1);
  });

  it('binds value, validity and touched through Signal Forms', async () => {
    const formsFixture = TestBed.createComponent(SignalFormsHost);
    await formsFixture.whenStable();

    const formsHost = formsFixture.componentInstance;
    const formsInput = (formsFixture.nativeElement as HTMLElement).querySelector('input');
    if (!formsInput) {
      throw new Error('inner input not rendered');
    }

    expect(formsHost.bookingForm.price().valid()).toBe(false);

    formsInput.dispatchEvent(new FocusEvent('focus'));
    formsInput.value = '9';
    formsInput.dispatchEvent(new FocusEvent('blur'));
    await formsFixture.whenStable();

    expect(formsHost.model().price).toBe(9);
    expect(formsHost.bookingForm.price().valid()).toBe(true);

    formsInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await formsFixture.whenStable();

    expect(formsHost.bookingForm.price().touched()).toBe(true);
  });

  // Regression: the control wrote `undefined` for an empty field, which a Signal Form reads as
  // a member that is not there.
  it('writes null into a Signal Form when the text is cleared', async () => {
    const formsFixture = TestBed.createComponent(NullableFormsHost);
    await formsFixture.whenStable();

    const formsHost = formsFixture.componentInstance;
    const formsInput = (formsFixture.nativeElement as HTMLElement).querySelector('input');
    if (!formsInput) {
      throw new Error('inner input not rendered');
    }
    expect(formsInput.value).toBe('');

    formsInput.dispatchEvent(new FocusEvent('focus'));
    formsInput.value = '16';
    formsInput.dispatchEvent(new FocusEvent('blur'));
    await formsFixture.whenStable();
    expect(formsHost.model().price).toBe(16);

    formsInput.dispatchEvent(new FocusEvent('focus'));
    formsInput.value = '';
    formsInput.dispatchEvent(new FocusEvent('blur'));
    await formsFixture.whenStable();

    expect(formsHost.model()).toEqual({ price: null });
    expect(formsHost.serviceForm.price().valid()).toBe(false);
  });
});

describe('InputNumber copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'inputNumber.errors.min': 'customer.min' }),
      ],
    });
    const fixture = TestBed.createComponent(SignalFormsHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { min: 'Go for {{min}} at least' } }, 'en', {
      merge: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('inputNumber/en'));
    const input = (fixture.nativeElement as HTMLElement).querySelector('input');
    if (!input) throw new Error('inner input not rendered');
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Go for 5 at least');
  });
});
