import { Component, input, signal } from '@angular/core';
import { form, FormField, min, required, submit } from '@angular/forms/signals';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { FloatLabel, IftaLabel } from '@ui/form-field';
import { InputNumber } from './input-number';
import { InputNumberButtonLayout, InputNumberMode, InputNumberSize } from './input-number.types';

const SIZES = ['sm', 'md', 'lg'] as const;

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-input-number-demo />` — the scaffolding, not the API.
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

// Demos are capped at a realistic form width — a field stretched to the
// viewport would misrepresent the layout.
const COLUMN = 'display: flex; flex-direction: column; gap: var(--space-3); max-width: 20rem;';
const HINT = 'color: var(--text-secondary); font-size: var(--text-sm); margin: 0;';

@Component({
  selector: 'lib-input-number-demo',
  imports: [InputNumber],
  template: `
    <div style="${COLUMN}">
      <lib-input-number
        [(value)]="value"
        [mode]="mode()"
        [currency]="currency()"
        [locale]="locale()"
        [prefix]="prefix()"
        [suffix]="suffix()"
        [showButtons]="showButtons()"
        [buttonLayout]="buttonLayout()"
        [showClear]="showClear()"
        [size]="size()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [invalid]="invalid()"
        [placeholder]="placeholder()"
      />
      <p style="${HINT}">Value: {{ value() ?? '—' }}</p>
    </div>
  `,
})
class InputNumberDemo {
  readonly mode = input<InputNumberMode>('decimal');
  readonly currency = input('EUR');
  readonly locale = input('el-GR');
  readonly prefix = input('');
  readonly suffix = input('');
  readonly showButtons = input(false);
  readonly buttonLayout = input<InputNumberButtonLayout>('stacked');
  readonly showClear = input(false);
  readonly size = input<InputNumberSize>('md');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly placeholder = input('');

  protected readonly value = signal<number | null>(null);
}

@Component({
  selector: 'lib-input-number-formats-demo',
  imports: [InputNumber],
  template: `
    <div style="display: flex; gap: var(--space-6); flex-wrap: wrap;">
      <lib-input-number [(value)]="grouped" locale="el-GR" placeholder="Numerals el-GR" />
      <lib-input-number
        [(value)]="fractions"
        locale="el-GR"
        [minFractionDigits]="2"
        placeholder="Min 2 fraction digits"
      />
      <lib-input-number
        [(value)]="euro"
        mode="currency"
        currency="EUR"
        locale="el-GR"
        placeholder="EUR el-GR"
      />
      <lib-input-number
        [(value)]="dollars"
        mode="currency"
        currency="USD"
        locale="en-US"
        placeholder="USD en-US"
      />
      <lib-input-number
        [(value)]="minutes"
        suffix=" min"
        [min]="0"
        [max]="240"
        showButtons
        [step]="5"
        placeholder="Duration"
      />
      <lib-input-number
        [(value)]="expiry"
        prefix="Day "
        [min]="1"
        [max]="31"
        placeholder="Prefix"
      />
    </div>
  `,
})
class InputNumberFormatsDemo {
  protected readonly grouped = signal<number | null>(1234567);
  protected readonly fractions = signal<number | null>(18);
  protected readonly euro = signal<number | null>(18);
  protected readonly dollars = signal<number | null>(24.5);
  protected readonly minutes = signal<number | null>(30);
  protected readonly expiry = signal<number | null>(15);
}

@Component({
  selector: 'lib-input-number-sizes-demo',
  imports: [InputNumber],
  template: `
    <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; align-items: flex-start;">
      @for (size of sizes; track size) {
        <lib-input-number [size]="size" showButtons [placeholder]="'Size ' + size" />
      }
    </div>
  `,
})
class InputNumberSizesDemo {
  protected readonly sizes = SIZES;
}

@Component({
  selector: 'lib-input-number-labels-demo',
  imports: [InputNumber, FloatLabel, IftaLabel],
  template: `
    <div style="display: flex; gap: var(--space-8); flex-wrap: wrap; padding-top: var(--space-6);">
      <div libFloatLabel>
        <lib-input-number
          [(value)]="price"
          mode="currency"
          currency="EUR"
          locale="el-GR"
          inputId="in-over"
          ariaLabelledby="in-over-label"
        />
        <label id="in-over-label" for="in-over">Price (over)</label>
      </div>

      <div libFloatLabel variant="in">
        <lib-input-number
          [(value)]="duration"
          suffix=" min"
          inputId="in-in"
          ariaLabelledby="in-in-label"
        />
        <label id="in-in-label" for="in-in">Duration (in)</label>
      </div>

      <div libIftaLabel>
        <lib-input-number
          [(value)]="tip"
          mode="currency"
          currency="EUR"
          locale="el-GR"
          inputId="in-ifta"
          ariaLabelledby="in-ifta-label"
        />
        <label id="in-ifta-label" for="in-ifta">Tip (IFTA)</label>
      </div>
    </div>
  `,
})
class InputNumberLabelsDemo {
  protected readonly price = signal<number | null>(null);
  protected readonly duration = signal<number | null>(30);
  protected readonly tip = signal<number | null>(2);
}

@Component({
  selector: 'lib-input-number-signal-forms-demo',
  imports: [InputNumber, FormField, Button],
  template: `
    <div style="${COLUMN}">
      <lib-input-number
        [formField]="bookingForm.price"
        mode="currency"
        currency="EUR"
        locale="el-GR"
        showButtons
        placeholder="Price"
        ariaLabel="Price"
      />

      <button libButton type="button" (click)="send()">Book</button>

      <p style="${HINT}">Model: {{ model().price }} • valid: {{ bookingForm.price().valid() }}</p>
    </div>
  `,
})
class InputNumberSignalFormsDemo {
  protected readonly model = signal({ price: 0 });
  protected readonly bookingForm = form(this.model, (schemaPath) => {
    required(schemaPath.price);
    min(schemaPath.price, 5);
  });

  /**
   * `submit()` rather than a hand-rolled handler: required is exposed as
   * `aria-required`, so nothing else is validating this form, and `submit()`
   * marks it touched so the message surfaces for a field never focused.
   */
  protected async send(): Promise<void> {
    await submit(this.bookingForm, () => Promise.resolve());
  }
}

const meta: Meta<InputNumberDemo> = {
  title: 'Forms & input/Number input',
  component: InputNumberDemo,
  decorators: [
    moduleMetadata({
      imports: [
        InputNumberDemo,
        InputNumberFormatsDemo,
        InputNumberSizesDemo,
        InputNumberLabelsDemo,
        InputNumberSignalFormsDemo,
      ],
    }),
    // The lib ships its own Transloco scope, and there is no global
    // provider in Storybook.
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
    mode: { control: 'select', options: ['decimal', 'currency'] },
    currency: { control: 'text' },
    locale: { control: 'text' },
    prefix: { control: 'text' },
    suffix: { control: 'text' },
    showButtons: { control: 'boolean' },
    buttonLayout: { control: 'select', options: ['stacked', 'horizontal'] },
    showClear: { control: 'boolean' },
    size: { control: 'select', options: SIZES },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    invalid: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  args: {
    mode: 'decimal',
    currency: 'EUR',
    locale: 'el-GR',
    prefix: '',
    suffix: '',
    showButtons: false,
    buttonLayout: 'stacked',
    showClear: false,
    size: 'md',
    disabled: false,
    readonly: false,
    invalid: false,
    placeholder: 'Amount',
  },
};

export default meta;
type Story = StoryObj<InputNumberDemo>;

/**
 * Interactive sandbox — flip any input with the controls below to preview
 * every combination. The rest of this page documents each feature in isolation.
 */
export const Basic: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine any inputs. While focused you edit a ' +
      'plain number; on blur the value commits (clamped to `min`/`max`) and ' +
      'renders formatted through `Intl.NumberFormat`.',
    `<lib-input-number [(value)]="amount" placeholder="Amount" />`,
  ),
};

export const NumeralsAndCurrency: Story = {
  render: () => ({ template: '<lib-input-number-formats-demo />' }),
  parameters: doc(
    'Formatting is driven by `locale` and `mode`. Set `mode="currency"` with a ' +
      '`currency` code for currency display, tune fraction digits with ' +
      '`minFractionDigits`/`maxFractionDigits`, and add literal `prefix`/' +
      '`suffix` strings — all applied on blur while the raw number stays editable.',
    `
<lib-input-number [(value)]="grouped" locale="el-GR" />
<lib-input-number [(value)]="euro" mode="currency" currency="EUR" locale="el-GR" />
<lib-input-number [(value)]="dollars" mode="currency" currency="USD" locale="en-US" />
<lib-input-number [(value)]="fractions" locale="el-GR" [minFractionDigits]="2" />
<lib-input-number [(value)]="minutes" suffix=" min" [min]="0" [max]="240" [step]="5" showButtons />
<lib-input-number [(value)]="day" prefix="Day " [min]="1" [max]="31" />
    `,
  ),
};

export const Buttons: Story = {
  args: { showButtons: true },
  parameters: doc(
    'Set `showButtons` to add spinner controls that increment/decrement by ' +
      '`step`. The default `stacked` layout places an up/down pair at the right ' +
      'edge. A `step` that cannot be used — `0`, a negative, a `NaN` — falls back ' +
      'to `1` instead of freezing the spinner.',
    `<lib-input-number [(value)]="amount" [step]="5" [min]="0" showButtons />`,
  ),
};

export const ButtonsHorizontal: Story = {
  args: { showButtons: true, buttonLayout: 'horizontal' },
  parameters: doc(
    'With `buttonLayout="horizontal"` the − and + buttons sit on either side of ' +
      'the field instead of stacking at the right edge.',
    `<lib-input-number [(value)]="amount" showButtons buttonLayout="horizontal" />`,
  ),
};

export const Clear: Story = {
  args: { showClear: true },
  parameters: doc(
    'Set `showClear` to show a × button while the field has a value; clicking it ' +
      "empties the input and returns focus. Its name comes from the lib's " +
      'Transloco scope, and `clearAriaLabel` overrides it.',
    `<lib-input-number [(value)]="amount" showClear />`,
  ),
};

export const Sizes: Story = {
  render: () => ({ template: '<lib-input-number-sizes-demo />' }),
  parameters: doc(
    'Three control heights — `sm`, `md` (default), and `lg` — matching the ' +
      'shared form-control sizes so number inputs align with buttons and text ' +
      'inputs on the same row.',
    `
<lib-input-number size="sm" showButtons />
<lib-input-number size="md" showButtons />
<lib-input-number size="lg" showButtons />
    `,
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: doc(
    'Set `disabled` to block interaction. The inner input gets the native ' +
      '`disabled` attribute and the spinner buttons are disabled too. Bound ' +
      'automatically by `[formField]`.',
    `<lib-input-number [(value)]="amount" disabled />`,
  ),
};

export const ReadOnly: Story = {
  args: { readonly: true, showClear: true, showButtons: true },
  parameters: doc(
    '`readonly` is not `disabled`: the value stays readable and the field stays ' +
      'focusable, but every affordance that would change it is withheld — no ' +
      'clear button, no step buttons, and typed text never commits. Each handler ' +
      're-checks the state, so a stale click cannot slip through.',
    `<lib-input-number [(value)]="amount" readonly showClear showButtons />`,
  ),
};

export const Invalid: Story = {
  args: { invalid: true },
  parameters: doc(
    'Set `invalid` for error styling and `aria-invalid="true"` on the input. ' +
      "Bound automatically by `[formField]` from a field's validation state — " +
      'and paired with `errors`, the control renders the message itself rather ' +
      'than signalling the state by colour alone.',
    `<lib-input-number [(value)]="amount" invalid />`,
  ),
};

export const Labels: Story = {
  render: () => ({ template: '<lib-input-number-labels-demo />' }),
  parameters: doc(
    'Pairs with the form-field label wrappers. Give the input an `inputId` so an ' +
      'external `<label for>` associates, and `ariaLabelledby` so screen readers ' +
      'announce it — shown here with over, in, and IFTA float-label variants.',
    `
<div libFloatLabel>
  <lib-input-number [(value)]="price" inputId="price" ariaLabelledby="price-label" />
  <label id="price-label" for="price">Price</label>
</div>
    `,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-input-number-signal-forms-demo />' }),
  parameters: doc(
    'Implements the Signal Forms `FormValueControl` contract, so `[formField]` ' +
      'binds value, disabled, invalid, touched, required and errors ' +
      'automatically, and blur marks the field touched. The control renders the ' +
      'first error itself — `required`, `min` and `max` are translated, and a ' +
      "validator's own `message` wins. Because required is exposed as " +
      "`aria-required`, submit through Signal Forms' `submit()`; a plain " +
      '`(submit)` handler would show no feedback for a field never focused.',
    `
import { form, min, required, submit } from '@angular/forms/signals';

readonly bookingForm = form(this.model, (path) => {
  required(path.price);
  min(path.price, 5);
});

async send(): Promise<void> {
  await submit(this.bookingForm, () => Promise.resolve());
}
    `,
    'ts',
  ),
};

export const Accessibility: Story = {
  render: () => ({ template: '<lib-input-number-formats-demo />' }),
  parameters: doc(
    [
      'The inner input implements the ARIA **spinbutton** pattern with full ' +
        'keyboard support and correct value semantics for assistive tech.',
      '',
      '- The input is **always named**: `ariaLabel`, or `ariaLabelledby` / ' +
        '`inputId` when pairing it with a visible `<label>`, and failing both it ' +
        "falls back to the lib's translated label rather than going unnamed.",
      '- The input carries `role="spinbutton"` with `aria-valuenow`, ' +
        '`aria-valuetext` (the formatted value), and `aria-valuemin`/`aria-valuemax` ' +
        'mirrored from `min`/`max`.',
      '- **Keyboard:** `ArrowUp`/`ArrowDown` step by `step`; `Home`/`End` jump to ' +
        '`min`/`max` when set.',
      '- `inputmode="decimal"` brings up the numeric keyboard on mobile.',
      '- The spinner buttons are decorative (`aria-hidden`, not tabbable) since the ' +
        'arrow keys cover stepping; the × clear button is a real named button.',
      '- **Required** is `aria-required`, never the native attribute, so the ' +
        'browser cannot block `submit()` with an untranslated bubble.',
      "- `ariaDescribedby` is **composed** with the control's own error id, never " +
        'overwritten, and the error is a `role="alert"` held back until the field ' +
        'is touched or blurred.',
      '- Focus rings and colour contrast meet **WCAG AA** in both themes, and ' +
        'every field state is restated in system colours under `forced-colors`.',
    ].join('\n'),
    `
<lib-input-number
  [formField]="form.duration"
  [min]="0"
  [max]="240"
  [step]="5"
  showButtons
  inputId="duration"
  ariaLabelledby="duration-label"
  ariaDescribedby="duration-hint"
/>
    `,
  ),
};
