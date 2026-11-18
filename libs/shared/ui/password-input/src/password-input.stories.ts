import { Component, input, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { FloatLabel, IftaLabel } from '@ui/form-field';
import { PasswordInput } from './password-input';
import { PasswordAutocomplete, PasswordFeedback, PasswordInputSize } from './password-input.types';
import { passwordRules } from './password-rules';
import { validatePassword } from './validate-password';

const SIZES = ['sm', 'md', 'lg'] as const;
const FEEDBACKS = ['none', 'inline', 'popover', 'side'] as const;
const AUTOCOMPLETES = ['current-password', 'new-password', 'off'] as const;

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-password-input-demo />` — the scaffolding, not the API. Overriding
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

// Demos are capped at a realistic form width — a field stretched to the
// viewport would misrepresent how the meter and checklist lay out.
const ROW = 'display: flex; flex-direction: column; gap: var(--space-4); max-width: 24rem;';
const HINT = 'color: var(--text-secondary); font-size: var(--text-sm); margin: 0;';

@Component({
  selector: 'lib-password-input-demo',
  imports: [PasswordInput],
  template: `
    <div style="${ROW}">
      <lib-password-input
        [(value)]="value"
        [size]="size()"
        [feedback]="feedback()"
        [showToggle]="showToggle()"
        [showClear]="showClear()"
        [showStrength]="showStrength()"
        [showRequirements]="showRequirements()"
        [autocomplete]="autocomplete()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [invalid]="invalid()"
        ariaLabel="Password"
      />
    </div>
  `,
})
class PasswordInputDemo {
  readonly size = input<PasswordInputSize>('md');
  readonly feedback = input<PasswordFeedback>('none');
  readonly showToggle = input(true);
  readonly showClear = input(false);
  readonly showStrength = input(true);
  readonly showRequirements = input(true);
  readonly autocomplete = input<PasswordAutocomplete>('current-password');
  readonly placeholder = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);

  protected readonly value = signal('');
}

@Component({
  selector: 'lib-password-input-sizes-demo',
  imports: [PasswordInput],
  template: `
    <div style="${ROW}">
      @for (size of sizes; track size) {
        <lib-password-input
          [size]="size"
          [placeholder]="size"
          [ariaLabel]="'Password (' + size + ')'"
        />
      }
    </div>
  `,
})
class PasswordInputSizesDemo {
  protected readonly sizes = SIZES;
}

@Component({
  selector: 'lib-password-input-labels-demo',
  imports: [PasswordInput, FloatLabel, IftaLabel],
  template: `
    <div style="${ROW}">
      <div libFloatLabel>
        <lib-password-input inputId="pw-over" />
        <label for="pw-over">Password (over)</label>
      </div>

      <div libFloatLabel variant="in">
        <lib-password-input inputId="pw-in" />
        <label for="pw-in">Password (in)</label>
      </div>

      <div libFloatLabel variant="on">
        <lib-password-input inputId="pw-on" />
        <label for="pw-on">Password (on)</label>
      </div>

      <div libIftaLabel>
        <lib-password-input inputId="pw-ifta" value="hunter2" />
        <label for="pw-ifta">Password (IFTA)</label>
      </div>
    </div>
  `,
})
class PasswordInputLabelsDemo {}

@Component({
  selector: 'lib-password-input-rules-demo',
  imports: [PasswordInput],
  template: `
    <div style="${ROW}">
      <lib-password-input feedback="inline" [rules]="rules" ariaLabel="Password" />
      <p style="${HINT}">
        A shorter, three-rule set: eight characters, a lowercase letter and a number — so the meter
        draws three segments instead of five.
      </p>
    </div>
  `,
})
class PasswordInputRulesDemo {
  protected readonly rules = passwordRules({
    minLength: 8,
    uppercase: false,
    special: false,
  });
}

@Component({
  selector: 'lib-password-input-signal-forms-demo',
  imports: [PasswordInput, Button, FormField],
  template: `
    <form style="${ROW}" (submit)="$event.preventDefault(); send()">
      <label for="pw-sf" style="${HINT}">Choose a password</label>

      <lib-password-input
        [formField]="signUpForm.password"
        inputId="pw-sf"
        feedback="popover"
        autocomplete="new-password"
        showClear
      />

      <button libButton type="submit">Create account</button>

      @if (accepted()) {
        <p style="${HINT}">Looks good.</p>
      }
    </form>
  `,
})
class PasswordInputSignalFormsDemo {
  protected readonly accepted = signal(false);
  protected readonly model = signal({ password: '' });
  protected readonly signUpForm = form(this.model, (signUp) => {
    required(signUp.password);
    validatePassword(signUp.password);
  });

  /**
   * `submit()` rather than a hand-rolled handler: it marks the form
   * touched, so errors surface for a field the user never focused. The
   * control deliberately carries no native `required`, so nothing else
   * is validating this form.
   */
  protected async send(): Promise<void> {
    this.accepted.set(await submit(this.signUpForm, () => Promise.resolve()));
  }
}

const meta: Meta<PasswordInputDemo> = {
  title: 'Forms & input/Password input',
  component: PasswordInputDemo,
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
    moduleMetadata({
      imports: [
        PasswordInputDemo,
        PasswordInputSizesDemo,
        PasswordInputLabelsDemo,
        PasswordInputRulesDemo,
        PasswordInputSignalFormsDemo,
      ],
    }),
  ],
  argTypes: {
    size: { control: 'select', options: SIZES },
    feedback: { control: 'select', options: FEEDBACKS },
    autocomplete: { control: 'select', options: AUTOCOMPLETES },
    showToggle: { control: 'boolean' },
    showClear: { control: 'boolean' },
    showStrength: { control: 'boolean' },
    showRequirements: { control: 'boolean' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
  args: {
    size: 'md',
    feedback: 'none',
    autocomplete: 'current-password',
    showToggle: true,
    showClear: false,
    showStrength: true,
    showRequirements: true,
    placeholder: '',
    disabled: false,
    invalid: false,
  },
};

export default meta;
type Story = StoryObj<PasswordInputDemo>;

/**
 * Interactive sandbox — flip any input with the controls below to preview
 * every combination. The rest of this page documents each feature in isolation.
 */
export const Basic: Story = {
  parameters: doc(
    'A masked `<input type="password">` in a bordered field that carries the ' +
      'focus ring, so the reveal and clear affordances sit inside it. ' +
      'Everything native still works — autofill, password managers, and ' +
      '`autocomplete` (switch it to `new-password` on sign-up and reset forms ' +
      'so managers offer to generate one).',
    `
<lib-password-input [(value)]="password" ariaLabel="Password" />
    `,
  ),
};

export const ToggleMask: Story = {
  args: { showClear: false },
  parameters: doc(
    'The reveal toggle is on by default; set `[showToggle]="false"` to drop ' +
      'it. It is a real `<button>` in the tab order, named "Show password" in ' +
      'both states with `aria-pressed` carrying the state — a name that flips ' +
      'while the button has focus gets re-announced mid-interaction. The ' +
      'toggle is withheld entirely while the field is `disabled`.\n\n' +
      'Bind `[(revealed)]` to drive it from outside, e.g. one switch that ' +
      'unmasks every field on a form.',
    `
<!-- The reveal toggle is on by default. -->
<lib-password-input [(value)]="password" ariaLabel="Password" />

<!-- Drop it. -->
<lib-password-input [(value)]="password" [showToggle]="false" ariaLabel="Password" />

<!-- Or drive it from outside — one switch unmasks a whole form. -->
<lib-password-input [(value)]="password" [(revealed)]="revealed" ariaLabel="Password" />
    `,
  ),
};

export const Requirements: Story = {
  args: { feedback: 'inline', showStrength: false },
  parameters: doc(
    'Set `feedback="inline"` and turn the meter off to show just the ' +
      'checklist. The rules come from the `rules` input, which defaults to ' +
      '`DEFAULT_PASSWORD_RULES` — twelve characters plus an uppercase letter, ' +
      'a lowercase letter, a number and a symbol. Unmet rules get a neutral ' +
      'dot rather than a cross: the list is a prompt, not a tally of ' +
      'mistakes.',
    `
<lib-password-input
  [(value)]="password"
  feedback="inline"
  [showStrength]="false"
  ariaLabel="Password" />
    `,
  ),
};

export const CustomRules: Story = {
  render: () => ({ template: '<lib-password-input-rules-demo />' }),
  parameters: doc(
    'Build a rule set with `passwordRules({ minLength, uppercase, lowercase, ' +
      'digit, special })`, or hand-write `PasswordRule[]` for anything else — ' +
      'each rule is a `key`, a `test`, and optional `params`/`label`. Pass the ' +
      '**same array** to `validatePassword` in the schema so the checklist and ' +
      'the form agree.\n\n' +
      'The character-class rules are Unicode-aware, so Greek passwords behave ' +
      'like Latin ones, and length counts grapheme clusters — an emoji is one ' +
      'character, not two.\n\n' +
      'Note the meter: three rules means three segments, one per requirement. ' +
      'The rating still runs the full five-point scale, just in bigger steps ' +
      '(weak → good → strong), so "Fair" means roughly the same thing here as ' +
      'it does on a five-rule form.',
    `
import { passwordRules, validatePassword } from '@ui/password-input';

// One array drives the checklist, the meter and the schema, so they
// cannot disagree.
protected readonly rules = passwordRules({
  minLength: 8,
  uppercase: false,
  special: false,
});

protected readonly signUpForm = form(this.model, (signUp) => {
  required(signUp.password);
  validatePassword(signUp.password, this.rules);
});

// Template
// <lib-password-input
//   [formField]="signUpForm.password"
//   [rules]="rules"
//   feedback="inline" />
    `,
    'ts',
  ),
};

export const StrengthMeter: Story = {
  args: { feedback: 'inline', showRequirements: false },
  parameters: doc(
    'A shield-and-label row over a segmented bar, with the rating as a tag ' +
      'on the right. Scored by `defaultPasswordStrength` against the same ' +
      'rules the checklist shows, on a five-point scale that walks the five ' +
      'semantic hues in order:\n\n' +
      '| Level | Word | Colour |\n| --- | --- | --- |\n' +
      '| 1 | Very weak | `--error` |\n| 2 | Weak | `--warning` |\n' +
      '| 3 | Fair | `--info` |\n| 4 | Good | `--accent` |\n' +
      '| 5 | Strong | `--success` |\n\n' +
      '**"Strong" is only reachable once every rule passes**, so the meter ' +
      'can never contradict the list. The state is always in words as well ' +
      'as colour, so it survives a monochrome or forced-colours rendering.\n\n' +
      '**The bar adapts to the rule count** — one segment per rule, lit by ' +
      'how many are satisfied. Five rules give one level per rule; three ' +
      'rules give three segments while the rating takes bigger steps up the ' +
      'same scale, so the wording stays comparable across forms. See ' +
      '*Custom rules* below.\n\n' +
      'The bar is `aria-hidden` and the rating is plain text rather than a ' +
      '`role="progressbar"`: "Password strength 75%" is noise for a ' +
      'qualitative rating. Swap `[strengthScorer]` for an entropy- or ' +
      'dictionary-based function when a rule count is too blunt.',
    `
<lib-password-input
  [(value)]="password"
  feedback="inline"
  [showRequirements]="false"
  ariaLabel="Password" />
    `,
  ),
};

export const Popover: Story = {
  args: { feedback: 'popover' },
  parameters: doc(
    'The production combination: `feedback="popover"` floats the meter **and** ' +
      'the checklist in a CDK overlay while the field has focus, so nothing ' +
      'shifts the layout.\n\n' +
      'The panel **never takes focus** — it opens on `focusin`, survives focus ' +
      'moving to the reveal or clear button, and closes on blur or Escape ' +
      '(Escape is only swallowed while the panel is open, so it still reaches ' +
      'a surrounding dialog otherwise). Being an overlay it also escapes ' +
      '`overflow: hidden` ancestors and flips above the field near the ' +
      'viewport bottom.',
    `
<lib-password-input
  [(value)]="password"
  feedback="popover"
  autocomplete="new-password"
  ariaLabel="Password" />
    `,
  ),
};

export const Side: Story = {
  args: { feedback: 'side' },
  parameters: doc(
    '`feedback="side"` floats the same panel **beside** the field instead of ' +
      'under it, top-aligned with it. A panel under the field covers whatever ' +
      'follows — the confirm-password field, the terms checkbox, the submit ' +
      'button — for as long as the field has focus; beside it, nothing the ' +
      'user is working through is hidden.\n\n' +
      'It behaves exactly like `popover` otherwise: opens on `focusin`, takes ' +
      'no focus, closes on blur or Escape.\n\n' +
      'Placement adapts. The panel prefers the end side, flips to the start ' +
      'side when the field sits near that edge of the viewport, and **falls ' +
      'back to the stacked placement** when the viewport is too narrow for ' +
      'either — so a phone gets the `popover` behaviour without the consumer ' +
      'switching modes. The entrance follows: it slides out of the edge the ' +
      'panel actually landed on. Unlike `popover`, the panel does not take ' +
      "the field's width; a side panel that copied a wide field would reach " +
      'the viewport edge.',
    `
<lib-password-input
  [(value)]="password"
  feedback="side"
  autocomplete="new-password"
  ariaLabel="Password" />
    `,
  ),
};

export const Labels: Story = {
  render: () => ({ template: '<lib-password-input-labels-demo />' }),
  parameters: doc(
    'Wrap in `[libFloatLabel]` (`over`, `in`, `on`) or `[libIftaLabel]` from ' +
      '`@ui/form-field`. The control reports focus, filled and invalid ' +
      'state through `:focus-within` and the `data-filled` / `data-invalid` ' +
      'host attributes, and consumes `--field-pad-top`, so the label wrappers ' +
      'need no knowledge of it.',
    `
<div libFloatLabel>
  <lib-password-input inputId="pw-over" />
  <label for="pw-over">Password</label>
</div>

<div libFloatLabel variant="in">
  <lib-password-input inputId="pw-in" />
  <label for="pw-in">Password</label>
</div>

<div libFloatLabel variant="on">
  <lib-password-input inputId="pw-on" />
  <label for="pw-on">Password</label>
</div>

<div libIftaLabel>
  <lib-password-input inputId="pw-ifta" />
  <label for="pw-ifta">Password</label>
</div>
    `,
  ),
};

export const ClearIcon: Story = {
  args: { showClear: true },
  parameters: doc(
    'Set `showClear` to add a clear button, which appears only once the field ' +
      'has a value and returns focus to the input afterwards. Like the reveal ' +
      'toggle it is withheld while `disabled` — a control the user cannot edit ' +
      'must not offer a control that edits it.',
    `
<lib-password-input [(value)]="password" showClear ariaLabel="Password" />
    `,
  ),
};

export const Sizes: Story = {
  render: () => ({ template: '<lib-password-input-sizes-demo />' }),
  parameters: doc(
    'Three sizes — `sm`, `md` (default) and `lg` — matching the shared ' +
      'form-control sizes, so a password field lines up with buttons and text ' +
      'inputs on the same row.',
    `
<lib-password-input size="sm" ariaLabel="Password (small)" />
<lib-password-input ariaLabel="Password" />
<!-- md is the default -->
<lib-password-input size="lg" ariaLabel="Password (large)" />
    `,
  ),
};

export const Disabled: Story = {
  args: { disabled: true, showClear: true, feedback: 'popover' },
  parameters: doc(
    'Set `disabled` to block interaction; `[formField]` binds it ' +
      'automatically. The reveal and clear buttons disappear and the feedback ' +
      'panel never opens.',
    `
<lib-password-input [(value)]="password" disabled ariaLabel="Password" />

<!-- Or let Signal Forms bind it from the field's own disabled state. -->
<lib-password-input [formField]="signUpForm.password" />
    `,
  ),
};

export const Invalid: Story = {
  args: { invalid: true },
  parameters: doc(
    'Set `invalid` for the error border, which is also reflected as ' +
      '`aria-invalid` on the input and `data-invalid` on the host (which the ' +
      "label wrappers pick up). `[formField]` binds it from the field's " +
      'validity.\n\n' +
      'Note that the border and the **message** are gated differently: the ' +
      'border follows validity, while the message waits until the field has ' +
      'been touched or blurred, so a pre-filled invalid value never accuses ' +
      'the user of a mistake they have not made yet.',
    `
<!-- Standalone: drive it yourself. -->
<lib-password-input [(value)]="password" invalid ariaLabel="Password" />

<!-- With Signal Forms it is bound from the field's validity. -->
<lib-password-input [formField]="signUpForm.password" />
    `,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-password-input-signal-forms-demo />' }),
  parameters: doc(
    'Implements the Signal Forms `FormValueControl<string>` contract, so ' +
      '`[formField]` binds `value`, `disabled`, `invalid`, `touched`, ' +
      '`required` and `errors`, and focuses the field on a submit error.\n\n' +
      'Validation lives in the **schema**, not the control:\n\n' +
      '```ts\n' +
      'const signUpForm = form(model, (signUp) => {\n' +
      '  required(signUp.password);\n' +
      '  validatePassword(signUp.password);\n' +
      '});\n' +
      '```\n\n' +
      '`validatePassword` skips empty values (pair it with `required`) and ' +
      'emits one error per unmet rule, kinded `password.<ruleKey>`, which the ' +
      'control renders as a translated message once the field is touched.\n\n' +
      '`required` reaches assistive technology as `aria-required`, never as ' +
      'the native `required` attribute — that would hand validation to the ' +
      'browser, which blocks submit entirely and raises an un-styleable ' +
      'bubble in the OS locale over the translated message below the field. ' +
      'So submit through `submit()` rather than a hand-rolled handler: it ' +
      'marks the form touched, so errors surface even for a field the user ' +
      'never focused.',
    `
import { form, required, submit } from '@angular/forms/signals';
import { validatePassword } from '@ui/password-input';

protected readonly model = signal({ password: '' });

protected readonly signUpForm = form(this.model, (signUp) => {
  required(signUp.password);
  validatePassword(signUp.password);
});

// The control carries no native \`required\`, so nothing validates this
// form for you. \`submit()\` marks it touched, surfacing errors for a
// field the user never focused.
protected async send(): Promise<void> {
  await submit(this.signUpForm, () => this.api.signUp(this.model()));
}

// Template
// <form (submit)="$event.preventDefault(); send()">
//   <label for="password">Choose a password</label>
//   <lib-password-input
//     [formField]="signUpForm.password"
//     inputId="password"
//     feedback="popover"
//     autocomplete="new-password"
//     showClear />
//   <button libButton type="submit">Create account</button>
// </form>
    `,
    'ts',
  ),
};

export const Accessibility: Story = {
  args: { feedback: 'popover', showClear: true },
  parameters: doc(
    'The hard part of a password field is telling a screen-reader user how ' +
      'they are doing without narrating every keystroke.\n\n' +
      '- **On focus**, `aria-describedby` reads a sentence built from the ' +
      'rules — so the requirements arrive *before* typing, even in popover ' +
      'mode where the panel lives at the end of `<body>`.\n' +
      '- **While typing**, a visually-hidden `role="status"` region announces ' +
      'a debounced summary once input settles (~600ms): *"Strength: Good. 3 ' +
      'of 5 requirements met. Missing: at least 12 characters, a special ' +
      'character."*\n' +
      '- **The visual panel is `aria-hidden`** — it only repeats both of the ' +
      'above, so exposing it too would say everything twice.\n\n' +
      '| Key | Action |\n| --- | --- |\n' +
      '| `Tab` | Input → clear → reveal toggle |\n' +
      '| `Enter` / `Space` | Activates the focused button |\n' +
      '| `Escape` | Closes the feedback panel; passes through when it is closed |\n\n' +
      'All copy is Transloco-scoped (`passwordInput`, Greek and English ' +
      'shipped), the focus indicator is the 2px accent border on the field, ' +
      'and the strength segments stay legible in forced-colors mode.',
    `
<!-- Name it with ariaLabel… -->
<lib-password-input [(value)]="password" ariaLabel="Password" feedback="popover" />

<!-- …or with an external label plus your own hint. The control appends
     its requirements and error ids to whatever you pass, so a consumer
     description is never clobbered. -->
<label for="password">Password</label>
<p id="password-hint">You can change this later in settings.</p>

<lib-password-input
  [(value)]="password"
  inputId="password"
  ariaDescribedby="password-hint"
  feedback="popover" />
    `,
  ),
};
