import { Component, computed, input, signal } from '@angular/core';
import { form, FormField, pattern, required, submit } from '@angular/forms/signals';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { InputOtp } from './input-otp';
import { InputOtpCellTemplate, InputOtpSeparatorTemplate } from './input-otp-templates';
import { InputOtpCharset, InputOtpSize } from './input-otp.types';

const SIZES = ['sm', 'md', 'lg'] as const;
const CHARSETS = ['numeric', 'alphanumeric'] as const;

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-input-otp-demo />` — the scaffolding, not the API.
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

const HINT = 'color: var(--text-secondary); font-size: var(--text-sm); margin: 0;';

@Component({
  selector: 'lib-input-otp-demo',
  imports: [InputOtp],
  template: `
    <div style="display: flex; flex-direction: column; gap: var(--space-4); max-width: 26rem;">
      <lib-input-otp
        [(value)]="value"
        [length]="length()"
        [charset]="charset()"
        [mask]="mask()"
        [separatorAfter]="separatorAfter()"
        [size]="size()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [invalid]="invalid()"
        (completed)="lastCompleted.set($event)"
      />
      <p style="${HINT}">Value: {{ value() || '—' }} • completed: {{ lastCompleted() || '—' }}</p>
    </div>
  `,
})
class InputOtpDemo {
  readonly length = input(4);
  readonly charset = input<InputOtpCharset>('numeric');
  readonly mask = input(false);
  readonly separatorAfter = input<readonly number[]>([]);
  readonly size = input<InputOtpSize>('md');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);

  protected readonly value = signal('');
  protected readonly lastCompleted = signal('');
}

@Component({
  selector: 'lib-input-otp-sizes-demo',
  imports: [InputOtp],
  template: `
    <div style="display: flex; gap: var(--space-6); flex-wrap: wrap; align-items: flex-start;">
      @for (size of sizes; track size) {
        <lib-input-otp [size]="size" [length]="4" [value]="'2024'" />
      }
    </div>
  `,
})
class InputOtpSizesDemo {
  protected readonly sizes = SIZES;
}

@Component({
  selector: 'lib-input-otp-template-demo',
  imports: [InputOtp, InputOtpCellTemplate, InputOtpSeparatorTemplate],
  template: `
    <lib-input-otp [(value)]="code" [length]="6" [separatorAfter]="[2, 4]" ariaLabel="Backup code">
      <ng-template libInputOtpCell let-char let-filled="filled">
        <span
          [style.color]="filled ? 'var(--accent-text)' : 'var(--text-muted)'"
          [style.font-weight]="filled ? 'var(--weight-bold)' : null"
        >
          {{ filled ? char : '•' }}
        </span>
      </ng-template>

      <ng-template libInputOtpSeparator>
        <span style="color: var(--accent-text);">•</span>
      </ng-template>
    </lib-input-otp>
  `,
})
class InputOtpTemplateDemo {
  protected readonly code = signal('12');
}

@Component({
  selector: 'lib-input-otp-sample-demo',
  imports: [InputOtp, Button],
  template: `
    <div
      style="display: flex; flex-direction: column; align-items: center; gap: var(--space-4); max-width: 26rem; text-align: center; padding: var(--space-6); background: var(--surface); border: var(--border-width-hairline) solid var(--border); border-radius: var(--radius-lg);"
    >
      <h2 id="otp-sample-title" class="t-h3" style="margin: 0;">Authenticate your account</h2>
      <p id="otp-sample-hint" style="margin: 0; color: var(--text-secondary);">
        Please enter the code sent to your phone.
      </p>

      <lib-input-otp
        [(value)]="code"
        [length]="6"
        [separatorAfter]="[3]"
        size="lg"
        ariaLabelledby="otp-sample-title"
        ariaDescribedby="otp-sample-hint"
        (completed)="verified.set(true)"
      />

      <div style="display: flex; gap: var(--space-3); width: 100%;">
        <button libButton variant="text" severity="secondary" style="flex: 1;" type="button">
          Resend code
        </button>
        <button
          libButton
          style="flex: 1;"
          type="button"
          [disabled]="!complete()"
          (click)="verified.set(true)"
        >
          Submit
        </button>
      </div>

      @if (verified()) {
        <p style="margin: 0; color: var(--success-text);" role="status">
          Code {{ code() }} submitted.
        </p>
      }
    </div>
  `,
})
class InputOtpSampleDemo {
  protected readonly code = signal('');
  protected readonly verified = signal(false);
  protected readonly complete = computed(() => this.code().length === 6);
}

@Component({
  selector: 'lib-input-otp-signal-forms-demo',
  imports: [InputOtp, FormField, Button],
  template: `
    <div style="display: flex; flex-direction: column; gap: var(--space-3); max-width: 24rem;">
      <label for="otp-sf" style="color: var(--text-secondary); font-size: var(--text-sm);">
        Verification code
      </label>

      <lib-input-otp [formField]="verifyForm.code" [length]="6" inputId="otp-sf" />

      <button libButton type="button" (click)="send()">Verify</button>

      <p style="${HINT}">
        Model: {{ model().code || '—' }} • valid: {{ verifyForm.code().valid() }}
      </p>
    </div>
  `,
})
class InputOtpSignalFormsDemo {
  protected readonly model = signal({ code: '' });
  protected readonly verifyForm = form(this.model, (schemaPath) => {
    required(schemaPath.code);
    pattern(schemaPath.code, /^[0-9]{6}$/);
  });

  /**
   * `submit()` rather than a hand-rolled handler: required is exposed as
   * `aria-required`, so nothing else validates this form, and `submit()`
   * marks it touched so the message surfaces for a field never focused.
   */
  protected async send(): Promise<void> {
    await submit(this.verifyForm, () => Promise.resolve());
  }
}

const meta: Meta<InputOtpDemo> = {
  title: 'Forms & input/OTP input',
  component: InputOtpDemo,
  decorators: [
    moduleMetadata({
      imports: [
        InputOtpDemo,
        InputOtpSizesDemo,
        InputOtpTemplateDemo,
        InputOtpSampleDemo,
        InputOtpSignalFormsDemo,
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
    length: { control: { type: 'number', min: 1, max: 10 } },
    charset: { control: 'select', options: CHARSETS },
    mask: { control: 'boolean' },
    size: { control: 'select', options: SIZES },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
  args: {
    length: 4,
    charset: 'numeric',
    mask: false,
    separatorAfter: [],
    size: 'md',
    disabled: false,
    readonly: false,
    invalid: false,
  },
};

export default meta;
type Story = StoryObj<InputOtpDemo>;

/**
 * Interactive sandbox — flip any input with the controls below to preview
 * every combination. The rest of this page documents each feature in isolation.
 */
export const Basic: Story = {
  parameters: doc(
    'A single real `<input>` sits invisibly over the drawn cells, so the whole ' +
      'code is one control with **one tab stop**. Arrow keys, Home/End, ' +
      'Backspace, selection, paste, undo, and `autocomplete="one-time-code"` ' +
      "autofill are all the browser's own behaviour. `length` sets the number " +
      'of cells (4 by default).',
    `<lib-input-otp [(value)]="code" [length]="4" />`,
  ),
};

export const SixDigits: Story = {
  args: { length: 6 },
  parameters: doc(
    'Set `length` for longer codes. Try pasting `123-456`: everything outside ' +
      'the charset is stripped and the remainder is truncated to the cell count — ' +
      'and the sanitized code is written back to the model, so a consumer never ' +
      'reads something the field is not showing.',
    `<lib-input-otp [(value)]="code" [length]="6" />`,
  ),
};

export const Mask: Story = {
  args: { length: 6, mask: true },
  parameters: doc(
    'Set `mask` to draw `•` in place of each character. This is a visual mask ' +
      'only — the field stays a plain text input, so `inputmode`, one-time-code ' +
      'autofill, and paste keep working and no password manager offers to save ' +
      'the code.',
    `<lib-input-otp [(value)]="code" [length]="6" mask />`,
  ),
};

export const Alphanumeric: Story = {
  args: { length: 6, charset: 'alphanumeric' },
  parameters: doc(
    '`charset` decides what the control accepts and which mobile keyboard it ' +
      'raises. The default `numeric` allows `0-9` and sets ' +
      '`inputmode="numeric"`; `alphanumeric` also allows `A-Z`/`a-z` and drops ' +
      'back to the standard keyboard. Case is preserved.',
    `<lib-input-otp [(value)]="code" [length]="6" charset="alphanumeric" />`,
  ),
};

export const Groups: Story = {
  args: { length: 6, separatorAfter: [3] },
  parameters: doc(
    '`separatorAfter` takes the one-based positions to break the code at — ' +
      '`[3]` on a six-digit code gives two groups of three. Separators are ' +
      'decorative and hidden from assistive technology; positions outside the ' +
      'code are ignored.',
    `<lib-input-otp [(value)]="code" [length]="6" [separatorAfter]="[3]" />`,
  ),
};

export const Sizes: Story = {
  render: () => ({ template: '<lib-input-otp-sizes-demo />' }),
  parameters: doc(
    'Three cell sizes — `sm`, `md` (default), and `lg` — matching the shared ' +
      'form-control sizes so an OTP field lines up with buttons and text inputs ' +
      'on the same row.',
    `
<lib-input-otp size="sm" [length]="4" />
<lib-input-otp size="md" [length]="4" />
<lib-input-otp size="lg" [length]="4" />
    `,
  ),
};

export const Disabled: Story = {
  args: { length: 6, disabled: true },
  parameters: doc(
    'Set `disabled` to block interaction: the inner input gets the native ' +
      '`disabled` attribute and pointer gestures are ignored. Bound ' +
      'automatically by `[formField]`.',
    `<lib-input-otp [(value)]="code" [length]="6" disabled />`,
  ),
};

export const ReadOnly: Story = {
  args: { length: 6, readonly: true },
  parameters: doc(
    '`readonly` is not `disabled`: the code stays readable, focusable and ' +
      'copyable, but every edit is refused — no typing, no paste, no caret ' +
      'placement by pointer. The handlers re-check the state, so a programmatic ' +
      '`beforeinput` cannot slip past the native attribute either.',
    `<lib-input-otp [(value)]="code" [length]="6" readonly />`,
  ),
};

export const Invalid: Story = {
  args: { length: 6, invalid: true },
  parameters: doc(
    'Set `invalid` for error styling and `aria-invalid="true"` on the input — ' +
      'the whole row turns to the error colour, since the code is one value ' +
      'rather than N independent fields. Pair it with `errors` (or just use ' +
      '`[formField]`) so the reason is carried as text too, not colour alone.',
    `<lib-input-otp [(value)]="code" [length]="6" invalid />`,
  ),
};

export const Template: Story = {
  render: () => ({ template: '<lib-input-otp-template-demo />' }),
  parameters: doc(
    'Project `<ng-template libInputOtpCell>` to render the cell contents ' +
      'yourself — the context gives you `$implicit` (the glyph to show, already ' +
      'masked), `char`, `index`, `filled`, and `active`. The cell box, its focus ' +
      'ring, and the caret stay with the component, so a custom renderer can ' +
      'change how the code looks but can never break how it behaves. ' +
      '`<ng-template libInputOtpSeparator>` does the same for the group dividers.',
    `
<lib-input-otp [(value)]="code" [length]="6" [separatorAfter]="[2, 4]">
  <ng-template libInputOtpCell let-char let-filled="filled">
    <span [style.color]="filled ? 'var(--accent-text)' : 'var(--text-muted)'">
      {{ filled ? char : '•' }}
    </span>
  </ng-template>

  <ng-template libInputOtpSeparator>•</ng-template>
</lib-input-otp>
    `,
  ),
};

export const Sample: Story = {
  render: () => ({ template: '<lib-input-otp-sample-demo />' }),
  parameters: doc(
    'A complete verification screen: a grouped six-digit code named by the ' +
      'heading through `ariaLabelledby`, described by the hint through ' +
      '`ariaDescribedby`, and a `(completed)` output that fires as soon as the ' +
      'last cell fills — use it to submit without making the user reach for the ' +
      'button.',
    `
<h2 id="otp-title">Authenticate your account</h2>
<p id="otp-hint">Please enter the code sent to your phone.</p>

<lib-input-otp
  [(value)]="code"
  [length]="6"
  [separatorAfter]="[3]"
  size="lg"
  ariaLabelledby="otp-title"
  ariaDescribedby="otp-hint"
  (completed)="verify($event)"
/>
    `,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-input-otp-signal-forms-demo />' }),
  parameters: doc(
    'Implements the Signal Forms `FormValueControl<string>` contract, so ' +
      '`[formField]` binds value, disabled, invalid, touched, required and ' +
      'errors automatically, and blur marks the field touched. The control ' +
      'renders the first error itself — `required`, `minLength` and `pattern` ' +
      "are translated, and a validator's own `message` wins. Because required " +
      "is exposed as `aria-required`, submit through Signal Forms' `submit()`.",
    `
import { form, pattern, required, submit } from '@angular/forms/signals';

readonly verifyForm = form(this.model, (path) => {
  required(path.code);
  pattern(path.code, /^[0-9]{6}$/);
});

async send(): Promise<void> {
  await submit(this.verifyForm, () => Promise.resolve());
}
    `,
    'ts',
  ),
};

export const Accessibility: Story = {
  args: { length: 6 },
  parameters: doc(
    'The control is **one** named input, not a row of boxes: screen readers ' +
      'announce it once, `Tab` moves past the whole code in a single step, and ' +
      'the cells are `aria-hidden` decoration. That avoids the two failures of ' +
      'the split-input build — unnamed textboxes, and auto-advancing focus that ' +
      'cuts off the character echo.\n\n' +
      '| Key | Action |\n| --- | --- |\n' +
      '| `Tab` | Moves into the code, then straight out of it |\n' +
      '| `←` / `→` | Move the caret between cells |\n' +
      '| `Home` / `End` | Jump to the first or last cell |\n' +
      '| `Backspace` / `Delete` | Remove a character |\n' +
      '| `Ctrl`/`Cmd` + `A` | Select the whole code |\n' +
      '| `Ctrl`/`Cmd` + `V` | Paste; anything outside the charset is stripped |\n' +
      '| Any allowed character | Overwrites the cell under the caret |\n\n' +
      'Name the field with `ariaLabel`, or with `inputId` + an external ' +
      '`<label for>` plus `ariaLabelledby`; failing both it falls back to the ' +
      "lib's translated label rather than going unnamed. Point " +
      '`ariaDescribedby` at the hint that says where the code was sent — the ' +
      'control appends its own error id rather than overwriting yours. Required ' +
      'is `aria-required`, never the native attribute. Focus is a solid 2px ' +
      'accent ring on the active cell, and every state is re-drawn against ' +
      'system colours in forced-colors mode.',
    `
<lib-input-otp
  [formField]="verifyForm.code"
  [length]="6"
  inputId="otp"
  ariaLabelledby="otp-label"
  ariaDescribedby="otp-hint"
/>
    `,
  ),
};
