import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideUiCopy } from '@util/ui-copy';
import { PasswordInput } from './password-input';
import { PasswordFeedback, PasswordInputSize, PasswordRule } from './password-input.types';
import { DEFAULT_PASSWORD_RULES, passwordRules } from './password-rules';
import { defaultPasswordStrength } from './password-strength';
import { validatePassword } from './validate-password';

@Component({
  imports: [PasswordInput],
  template: `
    <lib-password-input
      [(value)]="value"
      [size]="size()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [showToggle]="showToggle()"
      [showClear]="showClear()"
      [feedback]="feedback()"
      [rules]="rules()"
      ariaLabel="Password"
      (touch)="touchCount = touchCount + 1"
    />
  `,
})
class PasswordInputHost {
  readonly rules = signal<readonly PasswordRule[]>(DEFAULT_PASSWORD_RULES);
  readonly value = signal('');
  readonly size = signal<PasswordInputSize>('md');
  readonly disabled = signal(false);
  readonly invalid = signal(false);
  readonly showToggle = signal(true);
  readonly showClear = signal(false);
  readonly feedback = signal<PasswordFeedback>('none');
  readonly password = viewChild.required(PasswordInput);

  touchCount = 0;
}

@Component({
  imports: [PasswordInput],
  template: `
    <lib-password-input
      [(value)]="value"
      feedback="popover"
      ariaLabel="Password"
      ariaDescribedby="hint-outside"
    />
  `,
})
class PopoverHost {
  readonly value = signal('');
}

@Component({
  imports: [PasswordInput],
  template: ` <lib-password-input [(value)]="value" feedback="side" ariaLabel="Password" /> `,
})
class SideHost {
  readonly value = signal('');
}

@Component({
  imports: [PasswordInput, FormField],
  template: `<lib-password-input [formField]="signUpForm.password" ariaLabel="Password" />`,
})
class SignalFormsHost {
  readonly model = signal({ password: '' });
  readonly signUpForm = form(this.model, (path) => {
    required(path.password, { message: 'Password is required' });
    validatePassword(path.password);
  });
}

describe('PasswordInput', () => {
  let fixture: ComponentFixture<PasswordInputHost>;
  let host: PasswordInputHost;

  /** `ComponentFixture.nativeElement` is `any`; narrow it once, here. */
  function native(from: ComponentFixture<unknown>): HTMLElement {
    return from.nativeElement as HTMLElement;
  }

  function root(from: HTMLElement = native(fixture)): HTMLElement {
    const element = from.querySelector('lib-password-input');
    if (!element) {
      throw new Error('lib-password-input not rendered');
    }
    return element as HTMLElement;
  }

  function input(from?: HTMLElement): HTMLInputElement {
    const element = root(from).querySelector('input');
    if (!element) {
      throw new Error('inner input not rendered');
    }
    return element;
  }

  function buttons(from?: HTMLElement): HTMLButtonElement[] {
    return [...root(from).querySelectorAll('button')];
  }

  function toggle(from?: HTMLElement): HTMLButtonElement {
    const element = root(from).querySelector<HTMLButtonElement>('.password-toggle');
    if (!element) {
      throw new Error('reveal toggle not rendered');
    }
    return element;
  }

  function liveRegion(from?: HTMLElement): HTMLElement {
    const element = root(from).querySelector<HTMLElement>('[role="status"]');
    if (!element) {
      throw new Error('live region not rendered');
    }
    return element;
  }

  /** The overlay pane content, which CDK portals to `<body>`. */
  function overlayPanel(): HTMLElement | null {
    return document.body.querySelector('.password-panel');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function type(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  function configure(): void {
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
  }

  /** The `passwordInput` scope loads lazily via dynamic import. */
  async function loadTranslations(): Promise<void> {
    await firstValueFrom(TestBed.inject(TranslocoService).load('passwordInput/en'));
  }

  beforeEach(async () => {
    configure();
    fixture = TestBed.createComponent(PasswordInputHost);
    host = fixture.componentInstance;
    await settle();
    await loadTranslations();
    await settle();
  });

  describe('field', () => {
    it('masks the value and exposes a named input', () => {
      expect(input().type).toBe('password');
      expect(input().getAttribute('aria-label')).toBe('Password');
      expect(input().getAttribute('autocomplete')).toBe('current-password');
    });

    it('reflects size, disabled, invalid and filled on the host', async () => {
      expect(root().getAttribute('data-size')).toBe('md');
      expect(root().hasAttribute('data-filled')).toBe(false);

      host.size.set('lg');
      host.disabled.set(true);
      host.invalid.set(true);
      host.value.set('secret');
      await settle();

      expect(root().getAttribute('data-size')).toBe('lg');
      expect(root().hasAttribute('data-disabled')).toBe(true);
      expect(root().hasAttribute('data-invalid')).toBe(true);
      expect(root().hasAttribute('data-filled')).toBe(true);
      expect(input().disabled).toBe(true);
      expect(input().getAttribute('aria-invalid')).toBe('true');
    });

    it('writes typed text back into the value model', async () => {
      await type('Str0ng!Passphrase');
      expect(host.value()).toBe('Str0ng!Passphrase');
    });

    it('exposes required to AT without handing validation to the browser', async () => {
      const formsFixture = TestBed.createComponent(SignalFormsHost);
      await formsFixture.whenStable();
      const field = input(native(formsFixture));

      expect(field.getAttribute('aria-required')).toBe('true');
      // A native `required` would block submit and raise the browser's own
      // bubble over the message the form already renders.
      expect(field.hasAttribute('required')).toBe(false);
      expect(field.checkValidity()).toBe(true);
    });

    it('marks the field touched once focus leaves the control', async () => {
      input().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await settle();
      expect(host.touchCount).toBe(1);
    });

    it('does not mark it touched while focus stays inside', async () => {
      input().dispatchEvent(Object.assign(new FocusEvent('focusout', { bubbles: true }), {}));
      // Re-dispatch with the toggle as relatedTarget, which stays inside.
      const event = new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: toggle(),
      });
      host.touchCount = 0;
      input().dispatchEvent(event);
      await settle();

      expect(host.touchCount).toBe(0);
    });
  });

  describe('reveal toggle', () => {
    it('unmasks the value and carries state on aria-pressed', async () => {
      expect(toggle().getAttribute('aria-label')).toBe('Show password');
      expect(toggle().getAttribute('aria-pressed')).toBe('false');

      toggle().click();
      await settle();

      expect(input().type).toBe('text');
      // The name stays stable so it is not re-announced mid-interaction.
      expect(toggle().getAttribute('aria-label')).toBe('Show password');
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
    });

    it('is withheld while disabled and when showToggle is off', async () => {
      host.disabled.set(true);
      await settle();
      expect(buttons()).toHaveLength(0);

      host.disabled.set(false);
      host.showToggle.set(false);
      await settle();
      expect(buttons()).toHaveLength(0);
    });
  });

  describe('clear button', () => {
    it('appears only with a value, and clears and refocuses', async () => {
      host.showClear.set(true);
      await settle();
      expect(buttons()).toHaveLength(1); // toggle only

      host.value.set('secret');
      await settle();
      const clear = buttons()[0];
      expect(clear.getAttribute('aria-label')).toBe('Clear');

      clear.click();
      await settle();

      expect(host.value()).toBe('');
      expect(document.activeElement).toBe(input());
    });

    it('is withheld while disabled', async () => {
      host.showClear.set(true);
      host.value.set('secret');
      host.disabled.set(true);
      await settle();

      expect(buttons()).toHaveLength(0);
    });
  });

  describe('feedback panel', () => {
    it('renders nothing by default', async () => {
      await type('abc');
      expect(root().querySelector('.password-panel')).toBeNull();
      expect(input().getAttribute('aria-describedby')).toBeNull();
    });

    it('renders inline with a segmented meter and a checklist', async () => {
      host.feedback.set('inline');
      await type('Str0ng!Passphrase');

      const panel = root().querySelector('.password-panel');
      if (!panel) {
        throw new Error('feedback panel not rendered');
      }
      // The visuals repeat the describedby text and the live region.
      expect(panel.getAttribute('aria-hidden')).toBe('true');
      // In flow it is plain content, not a floating card.
      expect(panel.classList.contains('password-panel-floating')).toBe(false);
      // One segment per requirement, all lit because every rule passes.
      expect(panel.querySelectorAll('.password-strength-segment')).toHaveLength(
        DEFAULT_PASSWORD_RULES.length,
      );
      expect(panel.querySelectorAll('.password-strength-fill[data-on]')).toHaveLength(
        DEFAULT_PASSWORD_RULES.length,
      );
      expect(panel.querySelectorAll('.password-rule')).toHaveLength(DEFAULT_PASSWORD_RULES.length);
      expect(panel.querySelectorAll('.password-rule[data-met]')).toHaveLength(
        DEFAULT_PASSWORD_RULES.length,
      );
      expect(panel.querySelector('.password-strength-track')?.getAttribute('data-score')).toBe('5');
    });

    it('names the meter and tags the state in words, not colour alone', async () => {
      host.feedback.set('inline');
      await type('abcDEF12');

      const panel = root().querySelector('.password-panel');
      expect(panel?.querySelector('.password-strength-title')?.textContent.trim()).toBe(
        'Password strength',
      );
      const tag = panel?.querySelector('.password-strength-tag');
      expect(tag?.textContent.trim()).toBe('Fair');
      expect(tag?.getAttribute('data-score')).toBe('3');
    });

    it('draws one segment per rule, lit by how many are satisfied', async () => {
      host.rules.set(passwordRules({ minLength: 4, special: false, digit: false }));
      host.feedback.set('inline');
      await type('abc');

      const panel = root().querySelector('.password-panel');
      expect(panel?.querySelectorAll('.password-strength-segment')).toHaveLength(3);
      // Only the lowercase rule passes, so exactly one segment is lit —
      // even though the rating itself has already climbed to 2.
      expect(panel?.querySelectorAll('.password-strength-fill[data-on]')).toHaveLength(1);
      expect(panel?.querySelector('.password-strength-track')?.getAttribute('data-score')).toBe(
        '2',
      );
    });

    it('describes the input with the requirements instead of the panel', async () => {
      host.feedback.set('inline');
      await settle();

      const describedBy = input().getAttribute('aria-describedby');
      expect(describedBy).toMatch(/^lib-password-input-req-\d+$/);

      const requirements = root().querySelector(`[id="${describedBy}"]`);
      expect(requirements?.textContent).toContain('at least 12 characters');
      expect(requirements?.textContent).toContain('a special character');
    });
  });

  describe('strength scoring', () => {
    it('rates against the rules and reserves 5 for a complete checklist', () => {
      const rules = DEFAULT_PASSWORD_RULES;

      // The five default rules land one level per satisfied rule.
      expect(defaultPasswordStrength('', rules)).toBe(0);
      expect(defaultPasswordStrength('a', rules)).toBe(1);
      expect(defaultPasswordStrength('abcDEF', rules)).toBe(2);
      expect(defaultPasswordStrength('abcDEF12', rules)).toBe(3);
      expect(defaultPasswordStrength('abcDEF1!', rules)).toBe(4);
      expect(defaultPasswordStrength('abcDEF123!@x', rules)).toBe(5);
    });

    it('never reaches 5 while a rule is unmet, however long the value', () => {
      const rules = DEFAULT_PASSWORD_RULES;
      // Everything but a special character, well past the length rule.
      expect(defaultPasswordStrength('abcDEFghij1234567890', rules)).toBe(4);
    });

    it('takes bigger steps up the same scale with fewer rules', () => {
      const rules = passwordRules({ minLength: 4, special: false, digit: false });
      expect(rules).toHaveLength(3);

      expect(defaultPasswordStrength('abc', rules)).toBe(2);
      expect(defaultPasswordStrength('abcD', rules)).toBe(5);
    });

    it('honours a custom rule set', () => {
      const rules = passwordRules({ minLength: 4, special: false });
      expect(rules).toHaveLength(4);
      expect(defaultPasswordStrength('aB3x', rules)).toBe(5);
    });

    it('counts characters by code point and normalizes minLength', () => {
      const [lengthRule] = passwordRules({
        minLength: 3.9,
        uppercase: false,
        lowercase: false,
        digit: false,
        special: false,
      });
      expect(lengthRule.params).toEqual({ min: 3 });
      // Three astral code points read as three characters, not six.
      expect(lengthRule.test('ðŸ‘ðŸ‘ðŸ‘')).toBe(true);
    });

    it('accepts Greek letters as upper- and lowercase', () => {
      const rules = passwordRules({ minLength: 0, digit: false, special: false });
      expect(rules.every((rule) => rule.test('ÎšÎ±Î»Î·Î¼Î­ÏÎ±'))).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('reports one error per unmet rule and ignores empty values', async () => {
      const formsFixture = TestBed.createComponent(SignalFormsHost);
      await formsFixture.whenStable();
      const formsHost = formsFixture.componentInstance;

      // Empty: only `required` fires, not the rule errors.
      expect(
        formsHost.signUpForm
          .password()
          .errors()
          .map((error) => error.kind),
      ).toEqual(['required']);

      const passwordInput = input(native(formsFixture));
      passwordInput.value = 'abcdefghijkl';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      await formsFixture.whenStable();

      expect(formsHost.model().password).toBe('abcdefghijkl');
      expect(
        formsHost.signUpForm
          .password()
          .errors()
          .map((error) => error.kind),
      ).toEqual(['password.uppercase', 'password.digit', 'password.special']);

      passwordInput.value = 'abcDEF123!@x';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      await formsFixture.whenStable();

      expect(formsHost.signUpForm.password().valid()).toBe(true);
    });

    it('binds disabled, invalid and touched through Signal Forms', async () => {
      const formsFixture = TestBed.createComponent(SignalFormsHost);
      await formsFixture.whenStable();
      const formsHost = formsFixture.componentInstance;

      expect(formsHost.signUpForm.password().touched()).toBe(false);

      input(native(formsFixture)).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await formsFixture.whenStable();

      expect(formsHost.signUpForm.password().touched()).toBe(true);
      expect(root(native(formsFixture)).hasAttribute('data-invalid')).toBe(true);
    });
  });

  describe('popover', () => {
    let popoverFixture: ComponentFixture<PopoverHost>;

    async function settlePopover(): Promise<void> {
      popoverFixture.detectChanges();
      await popoverFixture.whenStable();
    }

    beforeEach(async () => {
      popoverFixture = TestBed.createComponent(PopoverHost);
      await settlePopover();
      await loadTranslations();
      await settlePopover();
    });

    afterEach(() => {
      popoverFixture.destroy();
    });

    it('opens on focus without taking focus, and closes on blur', async () => {
      const field = input(native(popoverFixture));
      expect(overlayPanel()).toBeNull();

      field.focus();
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settlePopover();

      expect(overlayPanel()?.classList).toContain('password-panel-floating');
      // The whole point: typing must never be interrupted.
      expect(document.activeElement).toBe(field);

      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await settlePopover();

      expect(overlayPanel()).toBeNull();
    });

    it('drops a pane still exiting when the panel reopens', async () => {
      const field = input(native(popoverFixture));
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settlePopover();

      // Blur then refocus before the exit animation could finish: exactly
      // one pane must survive, never the old one stacked under the new.
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settlePopover();

      expect(document.body.querySelectorAll('.password-panel')).toHaveLength(1);
      expect(document.body.querySelectorAll('.password-panel-leave')).toHaveLength(0);
    });

    it('stays open while focus moves to the reveal toggle', async () => {
      const field = input(native(popoverFixture));
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settlePopover();

      field.dispatchEvent(
        new FocusEvent('focusout', {
          bubbles: true,
          relatedTarget: toggle(native(popoverFixture)),
        }),
      );
      await settlePopover();

      expect(overlayPanel()).not.toBeNull();
    });

    it('closes on Escape and only swallows the key while open', async () => {
      const field = input(native(popoverFixture));
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settlePopover();

      const opened = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      const openedReachedDocument = vi.fn();
      document.addEventListener('keydown', openedReachedDocument);
      field.dispatchEvent(opened);
      await settlePopover();

      expect(overlayPanel()).toBeNull();
      expect(openedReachedDocument).not.toHaveBeenCalled();

      // Panel closed: Escape belongs to whatever surrounds the field.
      field.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
      await settlePopover();

      expect(openedReachedDocument).toHaveBeenCalledTimes(1);
      document.removeEventListener('keydown', openedReachedDocument);
    });

    it('appends its own ids to a consumer-supplied aria-describedby', () => {
      const attribute = input(native(popoverFixture)).getAttribute('aria-describedby');
      if (!attribute) {
        throw new Error('aria-describedby not composed');
      }
      const describedBy = attribute.split(' ');

      expect(describedBy[0]).toBe('hint-outside');
      expect(describedBy[1]).toMatch(/^lib-password-input-req-/);
    });
  });

  describe('side placement', () => {
    let sideFixture: ComponentFixture<SideHost>;

    async function settleSide(): Promise<void> {
      sideFixture.detectChanges();
      await sideFixture.whenStable();
    }

    beforeEach(async () => {
      sideFixture = TestBed.createComponent(SideHost);
      await settleSide();
      await loadTranslations();
      await settleSide();
    });

    afterEach(() => {
      sideFixture.destroy();
    });

    it('opens the same floating panel beside the field', async () => {
      const field = input(native(sideFixture));
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settleSide();

      const panel = overlayPanel();
      if (!panel) {
        throw new Error('feedback panel not rendered');
      }
      expect(panel.classList).toContain('password-panel-floating');
      expect(panel.getAttribute('data-placement')).toBe('end');
    });

    it('does not stretch the panel to the field width', async () => {
      const field = input(native(sideFixture));
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settleSide();

      // Only the stacked placement lines the panel up with the field; a side
      // panel keeps the width its own content and min-width give it.
      expect(overlayPanel()?.style.minWidth).toBe('');
    });

    it('closes on blur like the stacked panel', async () => {
      const field = input(native(sideFixture));
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settleSide();
      expect(overlayPanel()).not.toBeNull();

      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await settleSide();

      expect(overlayPanel()).toBeNull();
    });
  });

  describe('live region', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('announces a debounced summary rather than every keystroke', async () => {
      host.feedback.set('inline');
      await type('abc');

      // Nothing yet â€” the user is still typing.
      expect(liveRegion().textContent.trim()).toBe('');

      await type('abcDEF12');
      expect(liveRegion().textContent.trim()).toBe('');

      await vi.advanceTimersByTimeAsync(700);
      await settle();

      const announced = liveRegion().textContent;
      // 3 of 5 rules is the middle of the five-point scale.
      expect(announced).toContain('Strength: Fair.');
      expect(announced).toContain('3 of 5 requirements met.');
      expect(announced).toContain('Missing: at least 12 characters');
      expect(announced).toContain('a special character');
    });

    it('reports a complete checklist without listing what is missing', async () => {
      host.feedback.set('inline');
      await type('abcDEF123!@x');
      await vi.advanceTimersByTimeAsync(700);
      await settle();

      const announced = liveRegion().textContent;
      expect(announced).toContain('Strength: Strong.');
      expect(announced).toContain('All requirements met.');
      expect(announced).not.toContain('Missing');
    });

    it('goes quiet once the field is emptied', async () => {
      host.feedback.set('inline');
      await type('abcDEF12');
      await vi.advanceTimersByTimeAsync(700);
      await settle();
      expect(liveRegion().textContent.trim()).not.toBe('');

      await type('');
      await vi.advanceTimersByTimeAsync(700);
      await settle();

      expect(liveRegion().textContent.trim()).toBe('');
    });
  });
});

describe('PasswordInput copy', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({
          'passwordInput.show': 'customer.show',
          'passwordInput.announce.complete': 'customer.complete',
        }),
      ],
    });
    const fixture = TestBed.createComponent(PasswordInputHost);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(
      { customer: { show: 'Show your password', complete: 'Your password is ready.' } },
      'en',
      { merge: true },
    );
    fixture.componentInstance.feedback.set('inline');
    fixture.detectChanges();
    await fixture.whenStable();
    await firstValueFrom(transloco.load('passwordInput/en'));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.password-toggle')?.getAttribute('aria-label')).toBe(
      'Show your password',
    );

    // The announcement is built in TypeScript, so it proves the resolver path too.
    vi.useFakeTimers();
    const input = root.querySelector('input');
    if (!input) throw new Error('inner input not rendered');
    input.value = 'abcDEF123!@x';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(700);
    fixture.detectChanges();

    expect(root.querySelector('[role="status"]')?.textContent).toContain('Your password is ready.');
  });
});
