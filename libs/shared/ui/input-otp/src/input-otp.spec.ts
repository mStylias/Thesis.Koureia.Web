import { readFileSync } from 'node:fs';
import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { form, FormField, minLength, required, type ValidationError } from '@angular/forms/signals';
import { InputOtp } from './input-otp';
import { InputOtpCharset } from './input-otp.types';

const otpStyles = readFileSync('src/input-otp.scss', 'utf8');

@Component({
  imports: [InputOtp],
  template: `
    <lib-input-otp
      [(value)]="value"
      [length]="length()"
      [charset]="charset()"
      [mask]="mask()"
      [separatorAfter]="separatorAfter()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [invalid]="invalid()"
      [touched]="touched()"
      [required]="requiredField()"
      [errors]="errors()"
      [ariaLabel]="ariaLabel()"
      [ariaDescribedby]="ariaDescribedby()"
      (completed)="completions.push($event)"
      (touch)="touchCount = touchCount + 1"
    />
  `,
})
class InputOtpHost {
  readonly value = signal('');
  readonly length = signal(4);
  readonly charset = signal<InputOtpCharset>('numeric');
  readonly mask = signal(false);
  readonly separatorAfter = signal<readonly number[]>([]);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly invalid = signal(false);
  readonly touched = signal(false);
  readonly requiredField = signal(false);
  readonly errors = signal<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly ariaLabel = signal('');
  readonly ariaDescribedby = signal('');
  readonly otp = viewChild.required(InputOtp);

  readonly completions: string[] = [];
  touchCount = 0;
}

@Component({
  imports: [InputOtp],
  template: `<lib-input-otp autoFocus />`,
})
class AutoFocusHost {}

@Component({
  imports: [InputOtp, FormField],
  template: `<lib-input-otp [formField]="verifyForm.code" [length]="6" />`,
})
class SignalFormsHost {
  readonly model = signal({ code: '' });
  readonly verifyForm = form(this.model, (path) => {
    required(path.code, { message: 'Enter the code' });
    minLength(path.code, 6, { message: 'Enter all six digits' });
  });
}

describe('InputOtp', () => {
  let fixture: ComponentFixture<InputOtpHost>;
  let host: InputOtpHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-input-otp');
    if (!element) {
      throw new Error('lib-input-otp not rendered');
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

  function cells(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('.otp-cell')];
  }

  function chars(): string[] {
    return cells().map((cell) => cell.textContent.trim());
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /**
   * jsdom dispatches `beforeinput` but never performs the edit, so the
   * helpers below stand in for the browser: fire the event, honour a
   * `preventDefault`, then apply exactly what the browser would have.
   */
  function beforeInput(inputType: string, data: string | null): InputEvent {
    const event = new InputEvent('beforeinput', {
      data,
      bubbles: true,
      cancelable: true,
    });
    // jsdom's InputEvent ignores `inputType` in the init dict.
    Object.defineProperty(event, 'inputType', { value: inputType });
    input().dispatchEvent(event);
    return event;
  }

  function fireInput(inputType: string, data: string | null): void {
    const event = new InputEvent('input', { data, bubbles: true });
    Object.defineProperty(event, 'inputType', { value: inputType });
    input().dispatchEvent(event);
  }

  /** One keystroke on the focused control. */
  async function type(text: string): Promise<void> {
    for (const char of text) {
      const element = input();
      if (beforeInput('insertText', char).defaultPrevented) {
        await settle();
        continue;
      }
      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? start;
      const next = element.value.slice(0, start) + char + element.value.slice(end);
      // The browser drops the keystroke once maxlength is reached.
      if (next.length > Number(element.getAttribute('maxlength'))) {
        await settle();
        continue;
      }
      element.value = next;
      element.setSelectionRange(start + 1, start + 1);
      fireInput('insertText', char);
      await settle();
    }
  }

  async function paste(text: string): Promise<void> {
    const element = input();
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? start;
    element.value = element.value.slice(0, start) + text + element.value.slice(end);
    element.setSelectionRange(start + text.length, start + text.length);
    fireInput('insertFromPaste', text);
    await settle();
  }

  async function backspace(): Promise<void> {
    const element = input();
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? start;
    const from = start === end ? Math.max(0, start - 1) : start;
    element.value = element.value.slice(0, from) + element.value.slice(end);
    element.setSelectionRange(from, from);
    fireInput('deleteContentBackward', null);
    await settle();
  }

  async function focusInput(): Promise<void> {
    input().focus();
    await settle();
  }

  /** jsdom has no layout: lay the cells out on a 40px pitch by hand. */
  function stubCellGeometry(): void {
    cells().forEach((cell, index) => {
      cell.getBoundingClientRect = () => ({
        left: index * 40,
        right: index * 40 + 36,
        top: 0,
        bottom: 36,
        width: 36,
        height: 36,
        x: index * 40,
        y: 0,
        toJSON: () => ({}),
      });
    });
  }

  async function pointerdownAt(clientX: number): Promise<void> {
    root().dispatchEvent(
      new MouseEvent('pointerdown', { clientX, bubbles: true, cancelable: true }),
    );
    await settle();
  }

  async function caretTo(index: number): Promise<void> {
    input().setSelectionRange(index, index);
    input().dispatchEvent(new Event('select', { bubbles: true }));
    await settle();
  }

  function error(): HTMLElement | null {
    return root().querySelector<HTMLElement>('.otp-error');
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
    fixture = TestBed.createComponent(InputOtpHost);
    host = fixture.componentInstance;
    // The first render is what registers this lib's scope loader — the pipe
    // carries it — so the scope can only be awaited afterwards.
    await settle();
    await firstValueFrom(TestBed.inject(TranslocoService).load('inputOtp/en'));
    await settle();
  });

  it('renders one cell per requested character', async () => {
    expect(cells()).toHaveLength(4);

    host.length.set(6);
    await settle();
    expect(cells()).toHaveLength(6);
    expect(input().getAttribute('maxlength')).toBe('6');
  });

  it('falls back to four cells for an unusable length', async () => {
    host.length.set(0);
    await settle();
    expect(cells()).toHaveLength(4);

    host.length.set(-3);
    await settle();
    expect(cells()).toHaveLength(4);
  });

  it('fills cells as the user types and commits the code', async () => {
    await focusInput();
    await type('1234');

    expect(host.value()).toBe('1234');
    expect(chars()).toEqual(['1', '2', '3', '4']);
  });

  it('rejects characters outside the charset', async () => {
    await focusInput();
    await type('1a2');

    expect(host.value()).toBe('12');

    host.charset.set('alphanumeric');
    host.value.set('');
    await settle();
    await type('a1B2');
    expect(host.value()).toBe('a1B2');
  });

  it('raises the numeric keyboard only for numeric codes', async () => {
    expect(input().getAttribute('inputmode')).toBe('numeric');

    host.charset.set('alphanumeric');
    await settle();
    expect(input().getAttribute('inputmode')).toBe('text');
  });

  it('sanitizes and truncates a pasted code', async () => {
    host.length.set(6);
    await settle();
    await focusInput();
    await paste('123-456');

    expect(host.value()).toBe('123456');
    expect(input().value).toBe('123456');
  });

  it('drops pasted characters beyond the last cell', async () => {
    await focusInput();
    await paste('1234567');

    expect(host.value()).toBe('1234');
    expect(input().value).toBe('1234');
  });

  it('replaces the character under the caret instead of shifting the code', async () => {
    await focusInput();
    await type('1234');
    await caretTo(1);
    await type('9');

    expect(host.value()).toBe('1934');
    expect(input().selectionStart).toBe(2);
  });

  it('deletes backwards with Backspace', async () => {
    await focusInput();
    await type('1234');
    await backspace();

    expect(host.value()).toBe('123');
    expect(chars()).toEqual(['1', '2', '3', '']);
  });

  it('selects a complete code on focus so retyping starts over', async () => {
    host.value.set('1234');
    await settle();
    await focusInput();

    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe(4);
    expect(cells().every((cell) => cell.hasAttribute('data-selected'))).toBe(true);
  });

  it('resumes at the first empty cell on focus while incomplete', async () => {
    host.value.set('12');
    await settle();
    await focusInput();

    expect(input().selectionStart).toBe(2);
    expect(cells()[2].hasAttribute('data-active')).toBe(true);
    expect(cells()[2].querySelector('.otp-caret')).not.toBeNull();
  });

  it('marks only the caret cell active, and nothing while blurred', async () => {
    await focusInput();
    await type('12');
    await caretTo(0);

    expect(cells().map((cell) => cell.hasAttribute('data-active'))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    // A filled cell shows the ring but no caret bar.
    expect(cells()[0].querySelector('.otp-caret')).toBeNull();

    input().dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(cells().some((cell) => cell.hasAttribute('data-active'))).toBe(false);
  });

  it('puts the caret in the cell under the pointer', async () => {
    host.value.set('1234');
    await settle();
    stubCellGeometry();

    await pointerdownAt(50);

    expect(document.activeElement).toBe(input());
    expect(input().selectionStart).toBe(1);
    expect(input().selectionEnd).toBe(1);
    expect(cells()[1].hasAttribute('data-active')).toBe(true);
  });

  it('clamps a pointer past the code to the first empty cell', async () => {
    host.value.set('12');
    await settle();
    stubCellGeometry();

    await pointerdownAt(130);

    expect(input().selectionStart).toBe(2);
  });

  it('ignores pointer gestures while disabled', async () => {
    host.value.set('12');
    host.disabled.set(true);
    await settle();
    stubCellGeometry();

    await pointerdownAt(50);

    expect(document.activeElement).not.toBe(input());
  });

  it('emits completed on the last character and again after a correction', async () => {
    await focusInput();
    await type('1234');
    expect(host.completions).toEqual(['1234']);

    await caretTo(0);
    await type('9');
    expect(host.completions).toEqual(['1234', '9234']);

    await backspace();
    expect(host.completions).toEqual(['1234', '9234']);
  });

  it('masks the rendered characters without changing the value', async () => {
    host.mask.set(true);
    await settle();
    await focusInput();
    await type('1234');

    expect(chars()).toEqual(['•', '•', '•', '•']);
    expect(host.value()).toBe('1234');
    // Visual only: the field stays a plain text input.
    expect(input().getAttribute('type')).toBe('text');
  });

  it('renders separators at the requested positions only', async () => {
    host.length.set(6);
    host.separatorAfter.set([3]);
    await settle();

    const separators = root().querySelectorAll('.otp-separator');
    expect(separators).toHaveLength(1);
    expect([...root().querySelectorAll('.otp-cell, .otp-separator')].indexOf(separators[0])).toBe(
      3,
    );

    // A separator after the final cell, or before the first, is dropped.
    host.separatorAfter.set([0, 6, 9]);
    await settle();
    expect(root().querySelectorAll('.otp-separator')).toHaveLength(0);
  });

  it('sanitizes a value supplied from outside, model included', async () => {
    host.value.set('ab12cd34ef56');
    await settle();

    expect(chars()).toEqual(['1', '2', '3', '4']);
    expect(input().value).toBe('1234');
    // The model used to keep the raw string, so a consumer read back a value
    // longer and dirtier than the control was showing.
    expect(host.value()).toBe('1234');
  });

  it('re-truncates the model when the length shrinks', async () => {
    host.length.set(6);
    await settle();
    host.value.set('123456');
    await settle();

    host.length.set(4);
    await settle();

    expect(host.value()).toBe('1234');
    expect(chars()).toEqual(['1', '2', '3', '4']);
  });

  it('reflects disabled and invalid on the host and the input', async () => {
    host.disabled.set(true);
    host.invalid.set(true);
    await settle();

    expect(root().hasAttribute('data-disabled')).toBe(true);
    expect(root().hasAttribute('data-invalid')).toBe(true);
    expect(input().disabled).toBe(true);
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('names the single input rather than the individual cells', () => {
    // Falls back to the lib's translated label rather than going unnamed.
    expect(input().getAttribute('aria-label')).toBe('Verification code');
    expect(input().getAttribute('autocomplete')).toBe('one-time-code');
    expect(root().querySelector('.otp-cells')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks the field touched on blur', async () => {
    await focusInput();
    input().dispatchEvent(new FocusEvent('blur'));
    await settle();

    expect(host.touchCount).toBe(1);
  });

  it('lets ariaLabel override the translated name', async () => {
    host.ariaLabel.set('One-time code');
    await settle();

    expect(input().getAttribute('aria-label')).toBe('One-time code');
  });

  it('reflects read-only and refuses every edit', async () => {
    host.value.set('12');
    host.readonly.set(true);
    await settle();

    expect(root().hasAttribute('data-readonly')).toBe(true);
    expect(input().readOnly).toBe(true);

    await focusInput();
    await type('34');
    expect(host.value()).toBe('12');

    await paste('9999');
    expect(host.value()).toBe('12');
    expect(input().value).toBe('12');
  });

  it('ignores pointer gestures while read-only but keeps the code readable', async () => {
    host.value.set('12');
    host.readonly.set(true);
    await settle();
    stubCellGeometry();

    await pointerdownAt(50);

    // Focus is still allowed — the code has to be readable and copyable.
    expect(document.activeElement).toBe(input());
    expect(chars()).toEqual(['1', '2', '', '']);
  });

  it('exposes required as aria-required, never the native attribute', async () => {
    host.requiredField.set(true);
    await settle();

    expect(input().getAttribute('aria-required')).toBe('true');
    expect(input().hasAttribute('required')).toBe(false);
  });

  it('holds the error back until the field is touched or blurred', async () => {
    host.errors.set([{ kind: 'minLength' }]);
    await settle();

    expect(error()).toBeNull();
    expect(input().getAttribute('aria-describedby')).toBeNull();

    host.touched.set(true);
    await settle();

    expect(error()?.textContent.trim()).toBe('Fill in every digit of the code.');
    expect(error()?.getAttribute('role')).toBe('alert');
    expect(error()?.id).toMatch(/^lib-input-otp-error-\d+$/);
    expect(input().getAttribute('aria-describedby')).toBe(error()?.id);
  });

  it('surfaces the error after a blur, and prefers a validator message', async () => {
    host.errors.set([{ kind: 'required', message: 'Enter the code we sent you' }]);
    await settle();
    await focusInput();
    input().dispatchEvent(new FocusEvent('blur'));
    await settle();

    expect(error()?.textContent.trim()).toBe('Enter the code we sent you');
  });

  it('composes aria-describedby instead of overwriting the consumer value', async () => {
    host.ariaDescribedby.set('otp-hint');
    host.errors.set([{ kind: 'required' }]);
    host.touched.set(true);
    await settle();

    const describedBy = input().getAttribute('aria-describedby');
    expect(describedBy).toContain('otp-hint');
    expect(describedBy).toContain(error()?.id ?? 'missing');
  });

  it('focuses the inner input through the public focus method', async () => {
    host.otp().focus();
    await settle();

    expect(document.activeElement).toBe(input());
  });

  it('focuses itself on init when autoFocus is set', async () => {
    const autoFixture = TestBed.createComponent(AutoFocusHost);
    await autoFixture.whenStable();

    const autoInput = (autoFixture.nativeElement as HTMLElement).querySelector('input');

    expect(document.activeElement).toBe(autoInput);
  });

  it('binds value, validity, and touched through Signal Forms', async () => {
    const formsFixture = TestBed.createComponent(SignalFormsHost);
    await formsFixture.whenStable();

    const formsHost = formsFixture.componentInstance;
    const otpRoot = (formsFixture.nativeElement as HTMLElement).querySelector('lib-input-otp');
    const otpInput = otpRoot?.querySelector('input');
    if (!otpInput) {
      throw new Error('inner input not rendered');
    }

    expect(formsHost.verifyForm.code().valid()).toBe(false);

    otpInput.value = '246810';
    otpInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await formsFixture.whenStable();

    expect(formsHost.model().code).toBe('246810');
    expect(formsHost.verifyForm.code().valid()).toBe(true);

    otpInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await formsFixture.whenStable();

    expect(formsHost.verifyForm.code().touched()).toBe(true);
  });
});

// jsdom has no layout, so the rule that keeps the code on one row is read from the stylesheet.
describe('InputOtp layout', () => {
  it('shrinks the cells to fit one row instead of wrapping them', () => {
    const cellRule = /\.otp-cell\s*\{([^}]*)}/.exec(otpStyles)?.[1] ?? '';

    expect(otpStyles).not.toMatch(/flex-wrap:\s*wrap/);
    expect(cellRule).toMatch(/min-width:\s*0/);
    expect(cellRule).toMatch(/aspect-ratio:\s*1/);
    expect(cellRule).not.toMatch(/(^|\s)height:/);
  });
});

describe('InputOtp copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({ 'inputOtp.label': 'customer.code' }),
      ],
    });
    const fixture = TestBed.createComponent(InputOtpHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ customer: { code: 'The code we sent you' } }, 'en', {
      merge: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('inputOtp/en'));
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('lib-input-otp input');
    expect(input?.getAttribute('aria-label')).toBe('The code we sent you');
  });
});
