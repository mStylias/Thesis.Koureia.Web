import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { RadioGroup } from './radio-group';
import {
  RadioGroupOrientation,
  RadioGroupSize,
  RadioGroupVariant,
  RadioOption,
} from './radio-group.types';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-radio-group-demo />` — the scaffolding, not the API. Overriding
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

const SIZES = ['sm', 'md', 'lg'] as const;
const VARIANTS = ['classic', 'card'] as const;
const ORIENTATIONS = ['vertical', 'horizontal'] as const;

type Plan = 'basic' | 'pro' | 'enterprise';

const PLANS: RadioOption<Plan>[] = [
  { label: 'Basic', value: 'basic', description: '€0 / μήνα' },
  { label: 'Pro', value: 'pro', description: '€18 / μήνα' },
  { label: 'Enterprise', value: 'enterprise', description: 'Επικοινωνήστε μαζί μας' },
];

@Component({
  selector: 'lib-radio-group-demo',
  imports: [RadioGroup],
  template: `
    <lib-radio-group
      [(value)]="value"
      [options]="options"
      [variant]="variant()"
      [size]="size()"
      [orientation]="orientation()"
      [disabled]="disabled()"
      [invalid]="invalid()"
      [required]="required()"
      ariaLabel="Πλάνο συνδρομής"
    />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Επιλογή: {{ value() ?? '—' }}
    </p>
  `,
})
class RadioGroupDemo {
  readonly variant = input<RadioGroupVariant>('classic');
  readonly size = input<RadioGroupSize>('md');
  readonly orientation = input<RadioGroupOrientation>('vertical');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly required = input(false);
  protected readonly options = PLANS;
  protected readonly value = signal<Plan | null>('pro');
}

@Component({
  selector: 'lib-radio-group-signal-forms-demo',
  imports: [RadioGroup, FormField],
  template: `
    <lib-radio-group [formField]="planForm.plan" [options]="options" variant="card" />
    <p style="margin-top: var(--space-4); color: var(--text-secondary); font-size: var(--text-sm);">
      Model: {{ model().plan ?? '—' }} • touched: {{ planForm.plan().touched() }}
    </p>
  `,
})
class RadioGroupSignalFormsDemo {
  protected readonly options = PLANS;
  protected readonly model = signal<{ plan: Plan | null }>({ plan: null });
  protected readonly planForm = form(this.model);
}

const meta: Meta<RadioGroupDemo> = {
  title: 'Forms & input/Radio group',
  component: RadioGroupDemo,
  decorators: [
    moduleMetadata({
      imports: [RadioGroup, RadioGroupDemo, RadioGroupSignalFormsDemo],
    }),
  ],
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: SIZES },
    orientation: { control: 'select', options: ORIENTATIONS },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  args: {
    variant: 'classic',
    size: 'md',
    orientation: 'vertical',
    disabled: false,
    invalid: false,
    required: false,
  },
};

export default meta;
type Story = StoryObj<RadioGroupDemo>;

const OPTIONS_TS = `
const plans: RadioOption<Plan>[] = [
  { label: 'Basic', value: 'basic', description: '€0 / μήνα' },
  { label: 'Pro', value: 'pro', description: '€18 / μήνα' },
  { label: 'Enterprise', value: 'enterprise', description: 'Επικοινωνήστε μαζί μας' },
];
`;

export const Playground: Story = {
  parameters: doc(
    'Single choice from a small set. Use the controls to inspect variant, ' +
      'size, orientation, disabled, and invalid combinations.',
    `
<lib-radio-group
  [(value)]="plan"
  [options]="plans"
  variant="classic"
  size="md"
  orientation="vertical"
  ariaLabel="Πλάνο συνδρομής" />
${OPTIONS_TS}`,
  ),
};

export const Cards: Story = {
  args: { variant: 'card' },
  parameters: doc(
    'The `card` variant turns each option into a selectable tile for plan pickers.',
    `
<lib-radio-group
  [(value)]="plan"
  [options]="plans"
  variant="card"
  ariaLabel="Πλάνο συνδρομής" />
`,
  ),
};

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
  parameters: doc(
    'Options lay out in a row; arrow keys still move between them.',
    `
<lib-radio-group
  [(value)]="plan"
  [options]="plans"
  orientation="horizontal"
  ariaLabel="Πλάνο συνδρομής" />
`,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-radio-group-signal-forms-demo />' }),
  parameters: doc(
    'Implements `FormValueControl<T>`, so `[formField]` binds `value`, ' +
      '`disabled`, `invalid` and `required` without an adapter, and marks the ' +
      'field touched once focus leaves the whole group (moving between the ' +
      'radios does not count). `required` surfaces as `aria-required` on the ' +
      'group — submit through Signal Forms’ `submit()` so errors show.',
    `
<lib-radio-group [formField]="planForm.plan" [options]="plans" variant="card" />

<!-- … -->

protected readonly model = signal<{ plan: Plan | null }>({ plan: null });
protected readonly planForm = form(this.model, (path) => {
  required(path.plan, { message: 'Διαλέξτε πλάνο' });
});
`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'Each option is a native `<input type="radio">` sharing one group `name`, so ' +
        'the browser supplies arrow-key roving, single selection, focus, and form state.',
      '',
      '- The host is a `role="radiogroup"`; name it with `ariaLabel` or `ariaLabelledby`.',
      '- Each radio takes its accessible name from its wrapping `<label>`; an ' +
        'option `description` is read as part of it.',
      '- `invalid` is reflected through `aria-invalid` on the group and each radio, ' +
        'and `required` through **`aria-required`** on the group — never the native ' +
        'attribute, which would block the submit event and raise an OS-locale bubble.',
      '- Point `ariaDescribedby` at your own hint or error element; the group never ' +
        'overwrites it.',
      '- The visual circle and dot are decorative and hidden from assistive technology; ' +
        'a `forced-colors` block re-states the selected dot, the selected card and the ' +
        'focus ring, which a forced palette would otherwise drop.',
      '- Motion is a short transform transition, disabled under reduced motion.',
    ].join('\n'),
    `
<p id="plan-hint">Μπορείτε να αλλάξετε πλάνο οποιαδήποτε στιγμή.</p>

<lib-radio-group
  [(value)]="plan"
  [options]="plans"
  required
  ariaLabel="Πλάνο συνδρομής"
  ariaDescribedby="plan-hint" />
`,
  ),
};
