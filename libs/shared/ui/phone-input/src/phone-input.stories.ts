import { Component, input, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { PhoneInput } from './phone-input';
import { PhoneInputSize, PhoneNumberKind } from './phone-input.types';
import { greekMobileRule } from './phone-rules';
import { validatePhone } from './validate-phone';

@Component({
  selector: 'lib-phone-input-demo',
  imports: [PhoneInput],
  template: `
    <lib-phone-input
      [(value)]="value"
      [initialCountry]="initialCountry()"
      [allowedTypes]="allowedTypes()"
      [size]="size()"
      [disabled]="disabled()"
      [invalid]="invalid()"
    />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Value: {{ value() || '—' }}
    </p>
  `,
})
class PhoneInputDemo {
  readonly initialCountry = input<'gr' | 'gb' | 'de' | 'us'>('gr');
  readonly allowedTypes = input<PhoneNumberKind>('any');
  readonly size = input<PhoneInputSize>('md');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly value = signal('');
}

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-phone-input-demo />` — the scaffolding, not the API. Overriding
 * `docs.source.code` shows what a consumer would actually paste.
 *
 * The trade-off is that a snippet is static: it does not follow the
 * controls, and it is documentation rather than compiled code, so keep it
 * in step with the demo components above.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const PHONE_CONFIG = {
  allowedTypes: 'mobile',
  customRules: { gr: greekMobileRule },
} as const;

@Component({
  selector: 'lib-phone-input-form-demo',
  imports: [PhoneInput, FormField],
  template: `
    <label
      for="booking-phone"
      style="display: block; margin-bottom: var(--space-1); color: var(--text-secondary); font-size: var(--text-sm);"
    >
      Mobile phone
    </label>
    <lib-phone-input
      [formField]="bookingForm.phone"
      inputId="booking-phone"
      allowedTypes="mobile"
    />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Value: {{ model().phone || '—' }} • valid: {{ bookingForm.phone().valid() }} • errors:
      {{ errorKinds() }}
    </p>
  `,
})
class PhoneInputFormDemo {
  protected readonly model = signal({ phone: '' });

  protected readonly bookingForm = form(this.model, (booking) => {
    required(booking.phone);
    validatePhone(booking.phone, PHONE_CONFIG);
  });

  protected errorKinds(): string {
    return (
      this.bookingForm
        .phone()
        .errors()
        .map((error) => error.kind)
        .join(', ') || '—'
    );
  }
}

const meta: Meta<PhoneInputDemo> = {
  title: 'Forms & input/Phone input',
  component: PhoneInputDemo,
  decorators: [
    applicationConfig({
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
    }),
    moduleMetadata({ imports: [PhoneInputDemo, PhoneInputFormDemo] }),
  ],
  argTypes: {
    initialCountry: {
      control: 'select',
      options: ['gr', 'gb', 'de', 'us'],
    },
    allowedTypes: {
      control: 'select',
      options: ['any', 'mobile', 'fixedLine'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
  args: {
    initialCountry: 'gr',
    allowedTypes: 'any',
    size: 'md',
    disabled: false,
    invalid: false,
  },
};

export default meta;

type Story = StoryObj<PhoneInputDemo>;

/**
 * Interactive sandbox — flip any input with the controls below to preview
 * the country selector, as-you-type formatting, and example placeholder.
 * The rest of this page documents each input in isolation.
 */
export const Default: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine any inputs. The country selector, ' +
      'as-you-type formatting, and example-number placeholder come from ' +
      '`intl-tel-input`, loaded lazily on first render. The emitted `value` ' +
      'is always international E.164 form (e.g. `+306912345678`).',
    `
<lib-phone-input [(value)]="phone" initialCountry="gr" />
`,
  ),
};

export const Sizes: Story = {
  render: () => ({
    template: `
      <div style="display: grid; gap: var(--space-4); max-width: 20rem;">
        <lib-phone-input-demo size="sm" />
        <lib-phone-input-demo size="md" />
        <lib-phone-input-demo size="lg" />
      </div>
    `,
  }),
  parameters: doc(
    'Three control heights — `sm`, `md` (default), and `lg` — matching the ' +
      'shared form-control sizes so the phone input aligns with other ' +
      'fields on the same row.',
    `
<lib-phone-input [(value)]="phone" size="sm" />
<lib-phone-input [(value)]="phone" size="md" />
<lib-phone-input [(value)]="phone" size="lg" />
`,
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: doc(
    'Set `disabled` to block interaction across both the input and the ' +
      'country selector. When driven by `[formField]`, this state is bound ' +
      'automatically from the form.',
    `
<lib-phone-input [(value)]="phone" disabled />
`,
  ),
};

export const Invalid: Story = {
  args: { invalid: true },
  parameters: doc(
    'Set `invalid` to apply error styling. It is bound automatically by ' +
      '`[formField]`; the translated error message renders once the field ' +
      'has been touched — see the **SignalForm** story.',
    `
<lib-phone-input [(value)]="phone" invalid />
`,
  ),
};

/**
 * Signal Forms integration: `required()` plus `validatePhone` with
 * mobile-only numbers and the stricter Greek mobile rule. Type an
 * invalid number and blur to see the translated error.
 */
export const SignalForm: Story = {
  render: () => ({
    template: `
      <div style="max-width: 20rem; padding-top: var(--space-4);">
        <lib-phone-input-form-demo />
      </div>
    `,
  }),
  parameters: doc(
    'Signal Forms integration via `FormValueControl`. Bind `[formField]` and ' +
      'declare validation in the schema — here `required()` plus ' +
      '`validatePhone` restricted to `mobile` numbers with the stricter Greek ' +
      'mobile rule. `disabled`, `invalid`, `touched`, `required` and `errors` ' +
      'bind automatically; type an invalid number and blur to see the ' +
      'translated error. `required` surfaces as `aria-required`, so submit ' +
      'through Signal Forms’ `submit()` rather than a plain `(submit)` ' +
      'handler — that is what marks the form touched and surfaces errors.',
    `
<label for="booking-phone">Mobile phone</label>
<lib-phone-input
  [formField]="bookingForm.phone"
  inputId="booking-phone"
  allowedTypes="mobile" />

<!-- … -->

const PHONE_CONFIG = {
  allowedTypes: 'mobile',
  customRules: { gr: greekMobileRule },
} as const;

protected readonly model = signal({ phone: '' });
protected readonly bookingForm = form(this.model, (booking) => {
  required(booking.phone);
  validatePhone(booking.phone, PHONE_CONFIG);
});
`,
  ),
};

export const Accessibility: Story = {
  render: () => ({
    template: `
      <div style="max-width: 20rem; padding-top: var(--space-4);">
        <lib-phone-input-form-demo />
      </div>
    `,
  }),
  parameters: doc(
    [
      'The control wraps a native `<input>` so it inherits standard focus and ' +
        'keyboard behavior; give it an accessible name through an associated ' +
        '`<label for>` (via `inputId`), `ariaLabelledby`, or `ariaLabel`.',
      '',
      '- **Label the input** — pass `inputId` to pair it with a native ' +
        '`<label for>`, or set `ariaLabelledby`/`ariaLabel`. With none of ' +
        'these, a translated generic "Phone number" name is applied so the ' +
        'field is never unlabelled.',
      '- The input uses `type="tel"`, giving mobile keyboards the telephone ' +
        'keypad and assistive tech the correct field semantics.',
      '- The **country selector** is a keyboard-operable dropdown with ' +
        'per-language ARIA labels and a searchable country list, loaded from ' +
        'the active Transloco language.',
      '- When an error shows, its id is **appended** to whatever you passed ' +
        'as `ariaDescribedby`, never substituted for it, so a hint of your ' +
        'own and the control’s own message are both announced.',
      '- `required` is exposed as **`aria-required`**, never the native ' +
        'attribute: the native one blocks the submit event outright and ' +
        'raises an OS-locale bubble over the translated message this control ' +
        'already renders.',
      '- Errors surface only once the field is touched **and** the lazy ' +
        'plugin has initialized, so a pre-filled value never accuses the ' +
        'user of a mistake they have not made.',
      '- **Disabled** state is conveyed on both the input and the selector, ' +
        'and error text and focus rings meet **WCAG AA** contrast in light ' +
        'and dark themes. A `forced-colors` block re-states focus and the ' +
        'invalid border, which a forced palette would otherwise drop.',
    ].join('\n'),
    `
<label for="booking-phone">Mobile phone</label>
<p id="phone-hint">We only use this to confirm your appointment.</p>

<lib-phone-input
  [formField]="bookingForm.phone"
  inputId="booking-phone"
  ariaDescribedby="phone-hint"
  allowedTypes="mobile" />
`,
  ),
};
