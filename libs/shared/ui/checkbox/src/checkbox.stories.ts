import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Checkbox } from './checkbox';

/**
 * Shorthand for a per-story description in the autodocs page. The source
 * override keeps "Show code" on the component's own API — the generated
 * snippet would otherwise print the story's scaffolding.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const meta: Meta<Checkbox> = {
  title: 'Forms & input/Checkbox',
  component: Checkbox,
  decorators: [moduleMetadata({ imports: [Checkbox] })],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    indeterminate: { control: 'boolean' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  args: {
    size: 'md',
    indeterminate: false,
    disabled: false,
    invalid: false,
    required: false,
  },
  render: (args) => ({
    props: args,
    template: `
      <lib-checkbox
        [size]="size"
        [indeterminate]="indeterminate"
        [disabled]="disabled"
        [invalid]="invalid"
        [required]="required"
      >Remember me</lib-checkbox>
    `,
  }),
};

export default meta;
type Story = StoryObj<Checkbox>;

/**
 * Interactive sandbox — flip any input with the controls below to preview
 * every combination. The rest of this page documents each input and state
 * in isolation.
 */
export const Playground: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine any inputs. Every other example ' +
      'on this page isolates one input or state so you can see its effect on ' +
      'its own.',
    `<lib-checkbox [(value)]="remember">Remember me</lib-checkbox>`,
  ),
};

const column = (checkboxes: string) =>
  `<div style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3);">${checkboxes}</div>`;

export const Sizes: Story = {
  render: () => ({
    template: column(`
      <lib-checkbox size="sm" [value]="true">Small</lib-checkbox>
      <lib-checkbox size="md" [value]="true">Medium</lib-checkbox>
      <lib-checkbox size="lg" [value]="true">Large</lib-checkbox>
    `),
  }),
  parameters: doc(
    'Three control sizes — `sm`, `md` (default), and `lg` — matching the ' +
      'shared form-control sizes so a checkbox aligns with other inputs on ' +
      'the same row.',
    `
<lib-checkbox size="sm" [(value)]="small">Small</lib-checkbox>
<lib-checkbox size="md" [(value)]="medium">Medium</lib-checkbox>
<lib-checkbox size="lg" [(value)]="large">Large</lib-checkbox>
`,
  ),
};

export const States: Story = {
  render: () => ({
    template: column(`
      <lib-checkbox>Unchecked</lib-checkbox>
      <lib-checkbox [value]="true">Checked</lib-checkbox>
      <lib-checkbox indeterminate>Indeterminate</lib-checkbox>
      <lib-checkbox invalid>Invalid</lib-checkbox>
      <lib-checkbox invalid [value]="true">Invalid, checked</lib-checkbox>
      <lib-checkbox disabled>Disabled</lib-checkbox>
      <lib-checkbox disabled [value]="true">Disabled, checked</lib-checkbox>
    `),
  }),
  parameters: doc(
    'Every visual state. `value` toggles the check, `indeterminate` shows the ' +
      'mixed dash, `invalid` applies error styling (and `aria-invalid`), and ' +
      '`disabled` blocks interaction — the states combine freely.',
    `
<lib-checkbox [(value)]="checked">Checked</lib-checkbox>
<lib-checkbox indeterminate>Indeterminate</lib-checkbox>
<lib-checkbox invalid>Invalid</lib-checkbox>
<lib-checkbox disabled>Disabled</lib-checkbox>
`,
  ),
};

export const Group: Story = {
  render: () => ({
    props: {
      services: ['Κούρεμα', 'Ξύρισμα', 'Περιποίηση γενειάδας'],
      selected: [] as string[],
      toggle(service: string, checked: boolean): void {
        const current = this['selected'] as string[];
        this['selected'] = checked
          ? [...current, service]
          : current.filter((s: string) => s !== service);
      },
      toggleAll(checked: boolean): void {
        this['selected'] = checked ? [...(this['services'] as string[])] : [];
      },
    },
    template: `
      <div style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3);">
        <lib-checkbox
          [value]="selected.length === services.length"
          [indeterminate]="selected.length > 0 && selected.length < services.length"
          (valueChange)="toggleAll($event)"
        >Όλες οι υπηρεσίες</lib-checkbox>
        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3); padding-left: var(--space-6);">
          @for (service of services; track service) {
            <lib-checkbox
              [value]="selected.includes(service)"
              (valueChange)="toggle(service, $event)"
            >{{ service }}</lib-checkbox>
          }
        </div>
      </div>
    `,
  }),
  parameters: doc(
    'A parent/child "select all" pattern. The parent is `indeterminate` when ' +
      'some — but not all — children are selected, and `value` is `true` only ' +
      'when every child is. `indeterminate` is display-only, so the consumer ' +
      'owns the group logic and updates each `value` from `valueChange`. ' +
      'The browser clears the native `indeterminate` property on click; the ' +
      'component restores it, so a click that leaves the group partially ' +
      'selected keeps rendering the mixed dash.',
    `
<lib-checkbox
  [value]="selected().length === services.length"
  [indeterminate]="selected().length > 0 && selected().length < services.length"
  (valueChange)="toggleAll($event)"
>Όλες οι υπηρεσίες</lib-checkbox>

@for (service of services; track service) {
  <lib-checkbox
    [value]="selected().includes(service)"
    (valueChange)="toggle(service, $event)"
  >{{ service }}</lib-checkbox>
}
`,
  ),
};

export const WithoutLabel: Story = {
  render: () => ({
    template: `<lib-checkbox ariaLabel="Select row"></lib-checkbox>`,
  }),
  parameters: doc(
    'When no label content is projected — such as a checkbox in a table cell — ' +
      'set `ariaLabel` to give the control an accessible name for screen ' +
      'readers, or `ariaLabelledby` when a heading already names it.',
    `
<lib-checkbox ariaLabel="Select row" [(value)]="rowSelected" />

<h3 id="services-heading">Υπηρεσίες</h3>
<lib-checkbox ariaLabelledby="services-heading" [(value)]="allServices" />
`,
  ),
};

export const Required: Story = {
  render: () => ({
    template: column(`
      <lib-checkbox required>Accept the terms</lib-checkbox>
      <lib-checkbox required invalid ariaDescribedby="terms-error">
        Accept the terms
      </lib-checkbox>
      <p id="terms-error" style="margin: 0; color: var(--error-text); font-size: var(--text-sm);">
        You have to accept the terms to continue
      </p>
    `),
  }),
  parameters: doc(
    '`required` is exposed as **`aria-required`**, never the native ' +
      'attribute — the native one hands validation to the browser, which ' +
      'blocks the submit event outright and raises an OS-locale bubble over ' +
      "the form's own translated message. Submit through Signal Forms' " +
      '`submit()` instead, which marks the form touched so the error ' +
      'surfaces. Point `ariaDescribedby` at your error text to associate it ' +
      'with the control.',
    `
<lib-checkbox
  [formField]="signUpForm.terms"
  ariaDescribedby="terms-error"
>Accept the terms</lib-checkbox>

@if (signUpForm.terms().touched() && signUpForm.terms().errors().length) {
  <p id="terms-error">You have to accept the terms to continue</p>
}
`,
  ),
};

export const Accessibility: Story = {
  render: () => ({
    template: column(`
      <lib-checkbox [value]="true">Projected label doubles as the click target</lib-checkbox>
      <lib-checkbox ariaLabel="Select row"></lib-checkbox>
      <lib-checkbox invalid>Invalid state is announced</lib-checkbox>
      <lib-checkbox disabled>Disabled</lib-checkbox>
    `),
  }),
  parameters: doc(
    [
      'The component renders a **native** `<input type="checkbox">`, so it ' +
        'inherits the correct role, focus behavior, and `Space` toggling for ' +
        'free.',
      '',
      '- **Projected content is wrapped in a `<label>`**, so clicking the text ' +
        'toggles the box and screen readers announce the name — no `for`/`id` ' +
        'wiring needed.',
      '- **With no projected label, set `ariaLabel`** to give the control an ' +
        'accessible name (rendered as `aria-label`).',
      '- **`invalid` sets `aria-invalid="true"`** so assistive tech announces ' +
        'the error state.',
      '- The decorative box and check `<svg>` are `aria-hidden`, so the native ' +
        'input remains the single source of state.',
      '- **`required` is exposed as `aria-required`**, so the a11y tree ' +
        'reports the field as required without the browser taking over ' +
        'validation.',
      '- Focus rings and color contrast meet **WCAG AA** in both light and ' +
        'dark themes, and a `forced-colors` block re-states the checked fill ' +
        'and focus ring that a forced palette would otherwise drop.',
    ].join('\n'),
    `
<lib-checkbox [(value)]="remember">Projected label doubles as the click target</lib-checkbox>
<lib-checkbox ariaLabel="Select row" [(value)]="rowSelected" />
<lib-checkbox required invalid ariaDescribedby="terms-error">Accept the terms</lib-checkbox>
<lib-checkbox disabled>Disabled</lib-checkbox>
`,
  ),
};
