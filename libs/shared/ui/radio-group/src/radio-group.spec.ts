import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { RadioGroup } from './radio-group';
import { RadioGroupSize, RadioGroupVariant, RadioOption } from './radio-group.types';

type Plan = 'basic' | 'pro' | 'enterprise';

const PLANS: RadioOption<Plan>[] = [
  { label: 'Basic', value: 'basic', description: '€0 / mo' },
  { label: 'Pro', value: 'pro', description: '€18 / mo' },
  { label: 'Enterprise', value: 'enterprise', disabled: true },
];

@Component({
  imports: [RadioGroup],
  template: `
    <lib-radio-group
      [(value)]="value"
      [options]="options()"
      [size]="size()"
      [variant]="variant()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [required]="required()"
      [ariaLabel]="ariaLabel()"
      [ariaLabelledby]="ariaLabelledby()"
      [ariaDescribedby]="ariaDescribedby()"
      (touch)="touchCount = touchCount + 1"
    />
  `,
})
class RadioGroupHost {
  readonly value = signal<Plan | null>(null);
  readonly options = signal<RadioOption<Plan>[]>(PLANS);
  readonly size = signal<RadioGroupSize>('md');
  readonly variant = signal<RadioGroupVariant>('classic');
  readonly disabled = signal(false);
  readonly invalid = signal(false);
  readonly required = signal(false);
  readonly ariaLabel = signal('Plan');
  readonly ariaLabelledby = signal('');
  readonly ariaDescribedby = signal('');
  readonly group = viewChild.required(RadioGroup);

  touchCount = 0;
}

@Component({
  imports: [RadioGroup, FormField],
  template: `<lib-radio-group [formField]="planForm.plan" [options]="options" />`,
})
class SignalFormsHost {
  readonly options: RadioOption<Plan>[] = PLANS;
  readonly model = signal<{ plan: Plan | null }>({ plan: null });
  readonly planForm = form(this.model, (path) => {
    required(path.plan, { message: 'Pick a plan' });
  });
}

describe('RadioGroup', () => {
  let fixture: ComponentFixture<RadioGroupHost>;
  let host: RadioGroupHost;

  function root(): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector('lib-radio-group');
    if (!element) {
      throw new Error('lib-radio-group not rendered');
    }
    return element as HTMLElement;
  }

  function inputs(): HTMLInputElement[] {
    return Array.from(root().querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(RadioGroupHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('renders one native radio per option, all sharing a name', () => {
    const radios = inputs();
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => r.type === 'radio')).toBe(true);
    const names = new Set(radios.map((r) => r.name));
    expect(names.size).toBe(1);
    expect([...names][0]).toBeTruthy();
    expect(root().getAttribute('role')).toBe('radiogroup');
    expect(root().getAttribute('aria-label')).toBe('Plan');
    expect(root().textContent).toContain('€18 / mo');
  });

  it('selects a value on change and reflects it as checked', async () => {
    inputs()[1].click();
    await fixture.whenStable();

    expect(host.value()).toBe('pro');
    expect(inputs()[1].checked).toBe(true);
    expect(inputs()[0].checked).toBe(false);
  });

  it('follows a programmatic value', async () => {
    host.value.set('basic');
    await fixture.whenStable();

    expect(inputs()[0].checked).toBe(true);
  });

  it('disables an individual option', () => {
    const enterprise = inputs()[2];
    expect(enterprise.disabled).toBe(true);

    enterprise.click();
    expect(host.value()).toBeNull();
  });

  it('disables the whole group', async () => {
    host.disabled.set(true);
    await fixture.whenStable();

    expect(inputs().every((r) => r.disabled)).toBe(true);
    expect(root().hasAttribute('data-disabled')).toBe(true);
  });

  it('reflects size and variant to the host', async () => {
    host.size.set('lg');
    host.variant.set('card');
    await fixture.whenStable();

    expect(root().getAttribute('data-size')).toBe('lg');
    expect(root().getAttribute('data-variant')).toBe('card');
  });

  it('reflects invalid state to the host and native inputs', async () => {
    host.invalid.set(true);
    await fixture.whenStable();

    expect(root().hasAttribute('data-invalid')).toBe(true);
    expect(root().getAttribute('aria-invalid')).toBe('true');
    expect(inputs()[0].getAttribute('aria-invalid')).toBe('true');
  });

  it('exposes aria-labelledby for an external label', async () => {
    host.ariaLabelledby.set('plan-heading');
    await fixture.whenStable();

    expect(root().getAttribute('aria-labelledby')).toBe('plan-heading');
  });

  it('exposes required as aria-required, never the native attribute', async () => {
    host.required.set(true);
    await fixture.whenStable();

    expect(root().getAttribute('aria-required')).toBe('true');
    // The native attribute would block the submit event outright and
    // raise an OS-locale bubble over the form's translated message.
    expect(inputs().some((radio) => radio.hasAttribute('required'))).toBe(false);
    expect(inputs().some((radio) => radio.required)).toBe(false);
    // The mechanism itself: an unselected required group fails constraint
    // validation, and that is what suppresses the submit event.
    expect(inputs().every((radio) => radio.checkValidity())).toBe(true);
  });

  it('exposes aria-describedby for an external hint or error', async () => {
    host.ariaDescribedby.set('plan-hint');
    await fixture.whenStable();

    expect(root().getAttribute('aria-describedby')).toBe('plan-hint');
  });

  it('emits touch when focus leaves', async () => {
    inputs()[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await fixture.whenStable();

    expect(host.touchCount).toBe(1);
  });

  it('does not emit touch while focus moves between the radios', async () => {
    // Arrow keys hop focus from radio to radio, and every hop fires
    // focusout on the group — marking the field touched there would
    // surface its error mid-choice.
    inputs()[0].dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: inputs()[1] }),
    );
    await fixture.whenStable();

    expect(host.touchCount).toBe(0);
  });

  it('focus() targets the selected radio, else the first enabled one', async () => {
    host.group().focus();
    expect(document.activeElement).toBe(inputs()[0]);

    host.value.set('pro');
    await fixture.whenStable();
    host.group().focus();
    expect(document.activeElement).toBe(inputs()[1]);
  });

  it('binds value, invalid, and touched state through Signal Forms', async () => {
    const formsFixture = TestBed.createComponent(SignalFormsHost);
    await formsFixture.whenStable();

    const formsHost = formsFixture.componentInstance;
    const groupRoot = (formsFixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'lib-radio-group',
    );
    const radios = Array.from(
      groupRoot?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [],
    );

    expect(groupRoot?.hasAttribute('data-invalid')).toBe(true);

    radios[1].click();
    await formsFixture.whenStable();

    expect(formsHost.model().plan).toBe('pro');
    expect(formsHost.planForm.plan().valid()).toBe(true);

    radios[1].dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await formsFixture.whenStable();

    expect(formsHost.planForm.plan().touched()).toBe(true);
  });
});
