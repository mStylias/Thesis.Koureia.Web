import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Switch } from './switch';
import { SwitchSize } from './switch.types';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: the examples that hold state
 * render through a demo wrapper component, because a story object cannot
 * hold signals. Storybook's generated source would therefore read
 * `<lib-switch-demo />` — the scaffolding, not the API. Overriding
 * `docs.source.code` shows what a consumer would actually paste.
 *
 * The trade-off is that a snippet is static: it does not follow the
 * controls, and it is documentation rather than compiled code, so keep it
 * in step with the demo above it.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const SIZES = ['sm', 'md', 'lg'] as const;

@Component({
  selector: 'lib-switch-demo',
  imports: [Switch],
  template: `
    <lib-switch
      [(value)]="value"
      [size]="size()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [required]="required()"
    >
      Appointment reminders
    </lib-switch>
    <p style="margin-top: var(--space-3); color: var(--text-secondary); font-size: var(--text-sm);">
      State: {{ value() ? 'on' : 'off' }}
    </p>
  `,
})
class SwitchDemo {
  readonly size = input<SwitchSize>('md');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly required = input(false);
  protected readonly value = signal(false);
}

@Component({
  selector: 'lib-switch-settings-demo',
  imports: [Switch],
  template: `
    <div
      style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4);"
    >
      <lib-switch [(value)]="reminders">Υπενθυμίσεις ραντεβού</lib-switch>
      <lib-switch [(value)]="calendar">Συγχρονισμός ημερολογίου</lib-switch>
      <lib-switch [(value)]="marketing">Μηνύματα προσφορών</lib-switch>
    </div>
  `,
})
class SwitchSettingsDemo {
  protected readonly reminders = signal(true);
  protected readonly calendar = signal(false);
  protected readonly marketing = signal(false);
}

@Component({
  selector: 'lib-switch-signal-forms-demo',
  imports: [Switch, FormField],
  template: `
    <lib-switch [formField]="settingsForm.reminders"> Υπενθυμίσεις ραντεβού </lib-switch>
    <p style="margin-top: var(--space-3); color: var(--text-secondary); font-size: var(--text-sm);">
      Model: {{ model().reminders }} • touched:
      {{ settingsForm.reminders().touched() }}
    </p>
  `,
})
class SwitchSignalFormsDemo {
  protected readonly model = signal({ reminders: true });
  protected readonly settingsForm = form(this.model);
}

const meta: Meta<SwitchDemo> = {
  title: 'Forms & input/Switch',
  component: SwitchDemo,
  decorators: [
    moduleMetadata({
      imports: [Switch, SwitchDemo, SwitchSettingsDemo, SwitchSignalFormsDemo],
    }),
  ],
  argTypes: {
    size: { control: 'select', options: SIZES },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  args: {
    size: 'md',
    disabled: false,
    invalid: false,
    required: false,
  },
};

export default meta;
type Story = StoryObj<SwitchDemo>;

export const Playground: Story = {
  parameters: doc(
    'Interactive boolean setting. Use the **Controls** tab to combine any ' +
      'inputs; every other example on this page isolates one input or state ' +
      'so you can see its effect on its own.',
    `<lib-switch [(value)]="reminders">Appointment reminders</lib-switch>`,
  ),
};

export const Sizes: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4);">
        <lib-switch size="sm" [value]="true">Small</lib-switch>
        <lib-switch size="md" [value]="true">Medium</lib-switch>
        <lib-switch size="lg" [value]="true">Large</lib-switch>
      </div>
    `,
  }),
  parameters: doc(
    'Three control sizes — `sm`, `md` (default), and `lg` — tracking ' +
      '`--icon-size-*` so a switch lines up with icons and other controls on ' +
      'the same row.',
    `
<lib-switch size="sm" [(value)]="small">Small</lib-switch>
<lib-switch size="md" [(value)]="medium">Medium</lib-switch>
<lib-switch size="lg" [(value)]="large">Large</lib-switch>
`,
  ),
};

export const States: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4);">
        <lib-switch>Off</lib-switch>
        <lib-switch [value]="true">On</lib-switch>
        <lib-switch invalid>Invalid, off</lib-switch>
        <lib-switch invalid [value]="true">Invalid, on</lib-switch>
        <lib-switch disabled>Disabled, off</lib-switch>
        <lib-switch disabled [value]="true">Disabled, on</lib-switch>
      </div>
    `,
  }),
  parameters: doc(
    'Every visual state. `value` slides the thumb and fills the track, ' +
      '`invalid` applies error styling (and `aria-invalid`), and `disabled` ' +
      'blocks interaction — the states combine freely.',
    `
<lib-switch [(value)]="on">On</lib-switch>
<lib-switch invalid>Invalid</lib-switch>
<lib-switch disabled>Disabled</lib-switch>
`,
  ),
};

export const SettingsList: Story = {
  render: () => ({ template: '<lib-switch-settings-demo />' }),
  parameters: doc(
    'A realistic group of independently controlled settings. A switch applies ' +
      'its change immediately — if the setting only takes effect on submit, ' +
      'use a checkbox instead.',
    `
<lib-switch [(value)]="reminders">Υπενθυμίσεις ραντεβού</lib-switch>
<lib-switch [(value)]="calendar">Συγχρονισμός ημερολογίου</lib-switch>
<lib-switch [(value)]="marketing">Μηνύματα προσφορών</lib-switch>
`,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-switch-signal-forms-demo />' }),
  parameters: doc(
    'Implements `FormValueControl<boolean>`, so `[formField]` binds `value`, ' +
      '`disabled`, `invalid` and `required` without an adapter, and blur ' +
      'marks the field touched.',
    `
<lib-switch [formField]="settingsForm.reminders">
  Υπενθυμίσεις ραντεβού
</lib-switch>
`,
  ),
};

export const Required: Story = {
  args: { required: true },
  parameters: doc(
    '`required` is exposed as **`aria-required`**, never the native ' +
      'attribute — the native one hands validation to the browser, which ' +
      'blocks the submit event outright and raises an OS-locale bubble over ' +
      "the form's own translated message. Submit through Signal Forms' " +
      '`submit()` instead, which marks the form touched so the error ' +
      'surfaces. Point `ariaDescribedby` at your error text to associate it ' +
      'with the control.',
    `
<lib-switch
  [formField]="settingsForm.terms"
  ariaDescribedby="terms-error">
  Accept the terms
</lib-switch>

@if (settingsForm.terms().touched() && settingsForm.terms().errors().length) {
  <p id="terms-error">You have to accept the terms to continue</p>
}
`,
  ),
};

export const WithoutVisibleLabel: Story = {
  render: () => ({
    template: '<lib-switch ariaLabel="Enable appointment reminders" />',
  }),
  parameters: doc(
    'When no visible label is projected — such as a switch in a table row — ' +
      'set `ariaLabel` to give the control an accessible name, or ' +
      '`ariaLabelledby` when a heading already names it.',
    `
<lib-switch ariaLabel="Enable appointment reminders" [(value)]="reminders" />

<h3 id="notifications-heading">Ειδοποιήσεις</h3>
<lib-switch ariaLabelledby="notifications-heading" [(value)]="notifications" />
`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'A native checkbox retains focus, Space-key, click, and disabled behavior; ' +
        '`role="switch"` exposes the state as on/off.',
      '',
      '- Projected text is wrapped in a native `<label>` and enlarges the click target.',
      '- Use `ariaLabel` without visible text, or `ariaLabelledby` for an external label.',
      '- `invalid` is reflected through `aria-invalid`, and **`required` ' +
        'through `aria-required`** — never the native attribute, which would ' +
        'hand validation to the browser.',
      '- Use `ariaDescribedby` to link hint or error text to the switch.',
      '- The visual track and thumb are decorative and hidden from assistive technology.',
      '- The on state is carried by the thumb **position** as well as the ' +
        'track fill, so it never rests on colour alone; a `forced-colors` ' +
        'block re-states the fill, the thumb and the focus ring that a forced ' +
        'palette would otherwise drop along with the box-shadow.',
      '- Motion is a short transform transition, collapsed globally by the ' +
        'base layer under `prefers-reduced-motion` — the state change still ' +
        'applies, it just applies instantly.',
    ].join('\n'),
    `
<lib-switch [(value)]="reminders">Projected label doubles as the click target</lib-switch>
<lib-switch ariaLabel="Enable appointment reminders" [(value)]="reminders" />
<lib-switch invalid ariaDescribedby="reminders-error">Invalid state is announced</lib-switch>
<lib-switch disabled>Disabled</lib-switch>
`,
  ),
};
