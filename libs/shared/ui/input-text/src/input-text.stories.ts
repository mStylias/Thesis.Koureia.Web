import { Component, input, signal } from '@angular/core';
import { form, FormField, minLength, required } from '@angular/forms/signals';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { LucideSearch, LucideUser } from '@lucide/angular';
import { FloatLabel, IftaLabel } from '@ui/form-field';
import { IconField, InputIcon } from './icon-field/icon-field';
import { InputText } from './input-text';
import { InputTextSize } from './input-text.types';

const SIZES = ['sm', 'md', 'lg'] as const;

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-input-text-demo />` — the scaffolding, not the API.
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

@Component({
  selector: 'lib-input-text-demo',
  imports: [InputText],
  template: `
    <input
      libInputText
      [size]="size()"
      [invalid]="invalid()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [placeholder]="placeholder()"
      [value]="readonly() ? 'Kimonas Stylianidis' : ''"
      aria-label="Full name"
    />
  `,
})
class InputTextDemo {
  readonly size = input<InputTextSize>('md');
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly placeholder = input('Full name');
}

@Component({
  selector: 'lib-input-text-sizes-demo',
  imports: [InputText],
  template: `
    <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; align-items: flex-start;">
      @for (size of sizes; track size) {
        <input
          libInputText
          [size]="size"
          [placeholder]="'Size ' + size"
          [attr.aria-label]="'Size ' + size"
        />
      }
    </div>
  `,
})
class InputTextSizesDemo {
  protected readonly sizes = SIZES;
}

@Component({
  selector: 'lib-input-text-icons-demo',
  imports: [InputText, IconField, InputIcon, LucideSearch, LucideUser],
  template: `
    <div style="display: flex; gap: var(--space-6); flex-wrap: wrap;">
      <!-- Icon on the left -->
      <div libIconField>
        <span libInputIcon><svg lucideSearch></svg></span>
        <input libInputText placeholder="Search services" aria-label="Search services" />
      </div>

      <!-- Icon on the right -->
      <div libIconField iconPosition="right">
        <span libInputIcon><svg lucideUser></svg></span>
        <input libInputText placeholder="Barber name" aria-label="Barber name" />
      </div>

      <!-- Clear only -->
      <div libIconField showClear>
        <input libInputText placeholder="Type to clear" aria-label="Type to clear" />
      </div>

      <!-- Icon + clear together -->
      <div libIconField showClear>
        <span libInputIcon><svg lucideSearch></svg></span>
        <input libInputText placeholder="Search with clear" aria-label="Search with clear" />
      </div>
    </div>
  `,
})
class InputTextIconsDemo {}

@Component({
  selector: 'lib-input-text-labels-demo',
  imports: [InputText, IconField, InputIcon, LucideSearch, FloatLabel, IftaLabel],
  template: `
    <div style="display: flex; gap: var(--space-8); flex-wrap: wrap; padding-top: var(--space-6);">
      <div libFloatLabel>
        <input libInputText id="it-over" placeholder=" " />
        <label for="it-over">Name (over)</label>
      </div>

      <div libFloatLabel variant="in">
        <input libInputText id="it-in" placeholder=" " />
        <label for="it-in">Name (in)</label>
      </div>

      <div libFloatLabel variant="on">
        <input libInputText id="it-on" placeholder=" " />
        <label for="it-on">Name (on)</label>
      </div>

      <div libIftaLabel>
        <input libInputText id="it-ifta" placeholder=" " value="Kimonas" />
        <label for="it-ifta">Name (IFTA)</label>
      </div>

      <!-- Wrapped in libIconField the input is no longer a direct child, so
           the wrapper's data-filled contract is what the label reads. -->
      <div libFloatLabel>
        <div libIconField showClear>
          <span libInputIcon><svg lucideSearch></svg></span>
          <input libInputText id="it-icon" value="Fade" />
        </div>
        <label for="it-icon">Service (icon field)</label>
      </div>
    </div>
  `,
})
class InputTextLabelsDemo {}

@Component({
  selector: 'lib-input-text-signal-forms-demo',
  imports: [InputText, IconField, FormField],
  template: `
    <form style="display: flex; flex-direction: column; gap: var(--space-2); max-width: 20rem;">
      <div libIconField showClear>
        <input
          libInputText
          [formField]="bookingForm.name"
          placeholder="Full name"
          aria-label="Full name"
        />
      </div>

      @if (bookingForm.name().touched() && bookingForm.name().errors().length) {
        <span style="color: var(--error-text); font-size: var(--text-sm);">
          {{ bookingForm.name().errors()[0].message }}
        </span>
      }

      <span style="color: var(--text-secondary); font-size: var(--text-sm);">
        Model: {{ model().name || '—' }} • valid:
        {{ bookingForm.name().valid() }}
      </span>
    </form>
  `,
})
class InputTextSignalFormsDemo {
  protected readonly model = signal({ name: '' });
  protected readonly bookingForm = form(this.model, (schemaPath) => {
    required(schemaPath.name, { message: 'Name is required' });
    minLength(schemaPath.name, 3, { message: 'At least 3 characters' });
  });
}

const meta: Meta<InputTextDemo> = {
  title: 'Forms & input/Text input',
  component: InputTextDemo,
  decorators: [
    moduleMetadata({
      imports: [
        InputTextDemo,
        InputTextSizesDemo,
        InputTextIconsDemo,
        InputTextLabelsDemo,
        InputTextSignalFormsDemo,
      ],
    }),
    // `libIconField` ships its own Transloco scope for the clear button, and
    // there is no global provider in Storybook.
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
  ],
  argTypes: {
    size: { control: 'select', options: SIZES },
    invalid: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  args: {
    size: 'md',
    invalid: false,
    disabled: false,
    readonly: false,
    placeholder: 'Full name',
  },
};

export default meta;
type Story = StoryObj<InputTextDemo>;

/**
 * Interactive sandbox — flip any input with the controls below to preview
 * every combination. The rest of this page documents each input in isolation.
 */
export const Basic: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine `size`, `invalid`, `disabled`, ' +
      '`readonly`, and `placeholder`. Every other example on this page isolates ' +
      'one feature so you can see its effect on its own.',
    `<input libInputText placeholder="Full name" aria-label="Full name" />`,
  ),
};

export const Sizes: Story = {
  render: () => ({ template: '<lib-input-text-sizes-demo />' }),
  parameters: doc(
    'Three control heights — `sm`, `md` (default), and `lg` — matching the ' +
      'shared form-control sizes so the input aligns with buttons and selects ' +
      'on the same row.',
    `
<input libInputText size="sm" />
<input libInputText size="md" />
<input libInputText size="lg" />
    `,
  ),
};

export const Invalid: Story = {
  args: { invalid: true },
  parameters: doc(
    'Set `invalid` to show the error styling. It also reflects ' +
      '`aria-invalid="true"` on the native input so assistive tech announces ' +
      'the field as invalid. The attribute selector has no DOM of its own to ' +
      'render a message in, so always pair it with your own error text and point ' +
      '`aria-describedby` at it — the state must never be colour alone.',
    `
<input libInputText invalid aria-describedby="name-error" />
<p id="name-error">Enter your full name.</p>
    `,
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: doc(
    'The native `disabled` attribute blocks interaction and greys the ' +
      'control. This is the standard attribute on the underlying `<input>`, ' +
      'not a component input.',
    `<input libInputText disabled />`,
  ),
};

export const ReadOnly: Story = {
  args: { readonly: true },
  parameters: doc(
    'The native `readonly` attribute keeps the value readable, focusable and ' +
      'copyable while refusing edits. The hover border is dropped with it, since ' +
      'hover promises an edit — and inside `libIconField` the clear button is ' +
      'withheld for the same reason.',
    `<input libInputText readonly value="Kimonas Stylianidis" />`,
  ),
};

export const IconsAndClear: Story = {
  render: () => ({ template: '<lib-input-text-icons-demo />' }),
  parameters: doc(
    'Wrap the input in `libIconField` to place a decorative icon on the ' +
      '`left` or `right` (`iconPosition`), and/or add `showClear` for a × ' +
      'button that empties the input while it holds a value. The icon is ' +
      "`aria-hidden`; the button is a real named one (from the lib's Transloco " +
      'scope, or `clearAriaLabel`), is withheld while the input is `disabled` or ' +
      '`readonly`, and clearing dispatches a native `input` event so ' +
      '`[formField]` stays in sync.',
    `
<div libIconField showClear>
  <span libInputIcon><svg lucideSearch></svg></span>
  <input libInputText placeholder="Search services" aria-label="Search services" />
</div>
    `,
  ),
};

export const Labels: Story = {
  render: () => ({ template: '<lib-input-text-labels-demo />' }),
  parameters: doc(
    'Compose with the label wrappers from `@ui/form-field`. ' +
      '`libFloatLabel` (variants `over`, `in`, `on`) floats a `<label>` that ' +
      'settles into the field, and `libIftaLabel` keeps the label pinned ' +
      'above the value. A **direct-child** input needs `placeholder=" "` so the ' +
      'label can detect a value; wrapped in `libIconField` it is no longer a ' +
      'direct child, so the wrapper reports `data-filled` instead — which the ' +
      'label reads at any depth, and which also survives programmatic writes.',
    `
<div libFloatLabel>
  <input libInputText id="name" placeholder=" " />
  <label for="name">Name</label>
</div>

<div libFloatLabel>
  <div libIconField showClear>
    <span libInputIcon><svg lucideSearch></svg></span>
    <input libInputText id="service" />
  </div>
  <label for="service">Service</label>
</div>
    `,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-input-text-signal-forms-demo />' }),
  parameters: doc(
    'Bind `[formField]` to a Signal Forms field and the native input mirrors ' +
      'its value both ways. Drive `invalid` from the field state ' +
      '(`touched() && invalid()`) to surface validation only after ' +
      'interaction, and pair it with an error message for the user.',
    `
<input
  libInputText
  [formField]="bookingForm.name"
  [invalid]="bookingForm.name().touched() && bookingForm.name().invalid()"
  aria-describedby="name-error"
/>
@if (bookingForm.name().touched() && bookingForm.name().errors().length) {
  <span id="name-error">{{ bookingForm.name().errors()[0].message }}</span>
}
    `,
  ),
};

export const Accessibility: Story = {
  render: () => ({ template: '<lib-input-text-labels-demo />' }),
  parameters: doc(
    [
      'The component renders a **native** `<input>`, so it inherits the ' +
        'correct role, focus behavior, autofill, and keyboard handling for ' +
        'free.',
      '',
      '- **Always give the input an accessible name** — associate a ' +
        '`<label for>` (see the label wrappers) or, failing that, an ' +
        '`aria-label`.',
      '- **A `placeholder` is not a label** — it disappears on input and can ' +
        'fail contrast, so never rely on it as the only name.',
      '- **`invalid`** reflects `aria-invalid="true"`; pair it with an error ' +
        'message referenced by `aria-describedby` so the reason is announced.',
      '- Use `aria-describedby` to link hint or helper text to the input.',
      '- The **disabled** state uses the native `disabled` attribute, which ' +
        'assistive tech announces and which is removed from the tab order.',
      '- The **read-only** state uses the native `readonly` attribute, and every ' +
        'edit affordance is withheld with it — no clear button inside ' +
        '`libIconField`, and no hover border.',
      '- Focus rings and color contrast meet **WCAG AA** in both light and ' +
        'dark themes, including the invalid state, and the border and focus ring ' +
        'are restated in system colours under `forced-colors`.',
    ].join('\n'),
    `
<div libFloatLabel>
  <input libInputText id="name" placeholder=" " aria-describedby="name-hint" />
  <label for="name">Full name</label>
</div>
<p id="name-hint">As it appears on your ID.</p>
    `,
  ),
};
