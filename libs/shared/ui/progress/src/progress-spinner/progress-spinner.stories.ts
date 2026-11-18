import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { ProgressSpinner } from './progress-spinner';

/**
 * Shorthand for a per-story description in the autodocs page. Every story
 * renders a real template rather than a demo wrapper, so Storybook's generated
 * "Show code" already shows the API and needs no override.
 */
const doc = (markdown: string) => ({
  docs: { description: { story: markdown } },
});

const meta: Meta<ProgressSpinner> = {
  title: 'Feedback & status/Progress spinner',
  component: ProgressSpinner,
  decorators: [
    // The spinner ships a `progress` Transloco scope for the name an unnamed
    // spinner falls back to, and needs a root config to transpile against.
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
    moduleMetadata({ imports: [ProgressSpinner] }),
  ],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    mode: { control: 'inline-radio', options: ['indeterminate', 'determinate'] },
    spin: { control: 'inline-radio', options: ['linear', 'ease'] },
    tone: {
      control: 'select',
      options: ['accent', 'success', 'warning', 'error', 'info'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    showValue: { control: 'boolean' },
    unit: { control: 'text' },
  },
  args: {
    value: 75,
    mode: 'indeterminate',
    spin: 'linear',
    tone: 'accent',
    size: 'md',
    showValue: false,
    unit: '%',
  },
  render: (args) => ({
    props: args,
    template: `
      <lib-progress-spinner
        [value]="value"
        [mode]="mode"
        [spin]="spin"
        [tone]="tone"
        [size]="size"
        [showValue]="showValue"
        [unit]="unit"
        ariaLabel="Loading" />
    `,
  }),
};

export default meta;
type Story = StoryObj<ProgressSpinner>;

/**
 * Interactive sandbox — flip any input with the controls below. The rest of
 * this page isolates one feature at a time.
 */
export const Playground: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine any inputs. Every other example on ' +
      'this page isolates one feature so you can see its effect on its own.',
  ),
};

const row = (spinners: string) =>
  `<div style="display: flex; align-items: center; gap: var(--space-6);">${spinners}</div>`;

export const Indeterminate: Story = {
  render: () => ({
    template: row(`<lib-progress-spinner ariaLabel="Loading" />`),
  }),
  parameters: doc(
    'The default. A single arc rotates continuously for work of unknown ' +
      'length — the accepted exception to "no infinite loops" since it signals ' +
      'ongoing work. `prefers-reduced-motion` leaves a static arc.',
  ),
};

export const SpinStyle: Story = {
  render: () => ({
    template: row(`
      <lib-progress-spinner spin="linear" size="lg" ariaLabel="Linear spin" />
      <lib-progress-spinner spin="ease" size="lg" ariaLabel="Organic spin" />
    `),
  }),
  parameters: doc(
    'Two indeterminate motions. `spin="linear"` (left, default) rotates at a ' +
      'steady speed — a pure GPU `transform`. `spin="ease"` (right) is the ' +
      'organic Material-style spin: a steady rotation plus an eased arc ' +
      'grow/shrink, so the arc appears to speed up and slow down as it turns.',
  ),
};

export const Determinate: Story = {
  render: () => ({
    template: row(`
      <lib-progress-spinner mode="determinate" [value]="25" showValue ariaLabel="25 percent" />
      <lib-progress-spinner mode="determinate" [value]="50" showValue ariaLabel="50 percent" />
      <lib-progress-spinner mode="determinate" [value]="75" showValue ariaLabel="75 percent" />
      <lib-progress-spinner mode="determinate" [value]="100" showValue ariaLabel="100 percent" />
    `),
  }),
  parameters: doc(
    'With `mode="determinate"` and a `value`, the ring is **still** and filled ' +
      'to the exact percentage via `stroke-dashoffset` — no spinning, so the ' +
      'value reads clearly. `showValue` prints it in the centre.',
  ),
};

export const Tones: Story = {
  render: () => ({
    template: row(`
      <lib-progress-spinner mode="determinate" [value]="70" tone="accent" ariaLabel="Accent" />
      <lib-progress-spinner mode="determinate" [value]="70" tone="success" ariaLabel="Success" />
      <lib-progress-spinner mode="determinate" [value]="70" tone="warning" ariaLabel="Warning" />
      <lib-progress-spinner mode="determinate" [value]="70" tone="error" ariaLabel="Error" />
      <lib-progress-spinner mode="determinate" [value]="70" tone="info" ariaLabel="Info" />
    `),
  }),
  parameters: doc(
    'Copper `accent` (default) plus the muted semantic tones — `success`, ' +
      '`warning`, `error`, `info`. No arbitrary colours by design.',
  ),
};

export const Sizes: Story = {
  render: () => ({
    template: row(`
      <lib-progress-spinner size="sm" ariaLabel="Small" />
      <lib-progress-spinner size="md" ariaLabel="Medium" />
      <lib-progress-spinner size="lg" ariaLabel="Large" />
    `),
  }),
  parameters: doc(
    'Three diameters — `sm`, `md` (default), and `lg` — on the shared control ' +
      'scale. Stroke width scales with the diameter.',
  ),
};

export const CustomContent: Story = {
  render: () => ({
    template: row(`
      <lib-progress-spinner size="lg" mode="determinate" [value]="60" ariaLabel="Steps">3/5</lib-progress-spinner>
    `),
  }),
  parameters: doc(
    'Project content to replace the centred percentage with your own label — ' +
      'here a step count. Projected content does not need `showValue`: that ' +
      'input only governs the built-in percentage.',
  ),
};

export const Accessibility: Story = {
  render: () => ({
    template: row(`
      <lib-progress-spinner ariaLabel="Loading results" />
      <lib-progress-spinner mode="determinate" [value]="40" ariaLabel="Import progress" />
      <lib-progress-spinner />
    `),
  }),
  parameters: doc(
    [
      'The host carries `role="progressbar"` with `aria-valuemin/max`, plus ' +
        '`aria-valuenow` while determinate (omitted while indeterminate).',
      '',
      '- **Name the spinner** with `ariaLabel` or `ariaLabelledby`; with ' +
        'neither (the third spinner above) it falls back to the lib’s own ' +
        'translated `Loading` / `Progress` rather than reporting nothing. ' +
        'Passing both drops `aria-label`, since `aria-labelledby` wins the ' +
        'name computation anyway.',
      '- The `<svg>` is `aria-hidden` and `focusable="false"`, so the host is ' +
        'the single source of state for assistive tech.',
      '- Arc colours meet **WCAG AA** contrast in both themes, and a forced ' +
        'palette keeps the arc distinct from the ring behind it.',
      '- Respects `prefers-reduced-motion`: the rotation is replaced by a ' + 'static arc.',
    ].join('\n'),
  ),
};
