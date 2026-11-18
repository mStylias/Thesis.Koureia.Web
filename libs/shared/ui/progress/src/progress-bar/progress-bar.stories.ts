import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { ProgressBar } from './progress-bar';

/**
 * Shorthand for a per-story description in the autodocs page. Every story
 * renders a real template rather than a demo wrapper, so Storybook's generated
 * "Show code" already shows the API and needs no override.
 */
const doc = (markdown: string) => ({
  docs: { description: { story: markdown } },
});

const meta: Meta<ProgressBar> = {
  title: 'Feedback & status/Progress bar',
  component: ProgressBar,
  decorators: [
    // The bar ships a `progress` Transloco scope for the name an unnamed bar
    // falls back to, and needs a root config to transpile against.
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
    moduleMetadata({ imports: [ProgressBar] }),
  ],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    mode: { control: 'inline-radio', options: ['determinate', 'indeterminate'] },
    tone: {
      control: 'select',
      options: ['accent', 'success', 'warning', 'error', 'info'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    showValue: { control: 'boolean' },
    unit: { control: 'text' },
  },
  args: {
    value: 60,
    mode: 'determinate',
    tone: 'accent',
    size: 'md',
    showValue: true,
    unit: '%',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="inline-size: 22rem;">
        <lib-progress-bar
          [value]="value"
          [mode]="mode"
          [tone]="tone"
          [size]="size"
          [showValue]="showValue"
          [unit]="unit"
          ariaLabel="Upload progress" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<ProgressBar>;

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

const stack = (bars: string) =>
  `<div style="display: flex; flex-direction: column; gap: var(--space-5); inline-size: 22rem;">${bars}</div>`;

export const Determinate: Story = {
  render: () => ({
    template: stack(`
      <lib-progress-bar [value]="0" ariaLabel="0 percent" />
      <lib-progress-bar [value]="35" ariaLabel="35 percent" />
      <lib-progress-bar [value]="70" ariaLabel="70 percent" />
      <lib-progress-bar [value]="100" ariaLabel="100 percent" />
    `),
  }),
  parameters: doc(
    'The default mode. The track fills to `value` (`0`–100), and the rounded ' +
      'percentage is printed alongside it. Out-of-range values are clamped.',
  ),
};

export const Dynamic: Story = {
  render: () => ({
    props: {
      value: 20,
      step(this: { value: number }, by: number): void {
        this.value = Math.min(100, Math.max(0, this.value + by));
      },
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: var(--space-4); inline-size: 22rem;">
        <lib-progress-bar [value]="value" ariaLabel="Download progress" />
        <div style="display: flex; gap: var(--space-2);">
          <button type="button" (click)="step(-10)">−10</button>
          <button type="button" (click)="step(10)">+10</button>
        </div>
      </div>
    `,
  }),
  parameters: doc(
    'The bar reacts to `value` changes: bind a signal and update it, and the ' +
      'fill animates to the new width (a deliberate, low-frequency transition).',
  ),
};

export const Indeterminate: Story = {
  render: () => ({
    template: stack(`
      <lib-progress-bar mode="indeterminate" ariaLabel="Loading" />
    `),
  }),
  parameters: doc(
    'For work of unknown length, set `mode="indeterminate"`. A segment travels ' +
      'across the track and no value is announced. Under `prefers-reduced-' +
      'motion` it degrades to a static, dimmed track.',
  ),
};

export const Tones: Story = {
  render: () => ({
    template: stack(`
      <lib-progress-bar [value]="70" tone="accent" ariaLabel="Accent" />
      <lib-progress-bar [value]="70" tone="success" ariaLabel="Success" />
      <lib-progress-bar [value]="70" tone="warning" ariaLabel="Warning" />
      <lib-progress-bar [value]="70" tone="error" ariaLabel="Error" />
      <lib-progress-bar [value]="70" tone="info" ariaLabel="Info" />
    `),
  }),
  parameters: doc(
    'Copper `accent` (default) carries most progress. The muted semantic ' +
      'tones — `success`, `warning`, `error`, `info` — let a bar reflect the ' +
      'status of what it tracks. No arbitrary colours by design.',
  ),
};

export const Sizes: Story = {
  render: () => ({
    template: stack(`
      <lib-progress-bar size="sm" [value]="60" ariaLabel="Small" />
      <lib-progress-bar size="md" [value]="60" ariaLabel="Medium" />
      <lib-progress-bar size="lg" [value]="60" ariaLabel="Large" />
    `),
  }),
  parameters: doc(
    'Three track heights — `sm`, `md` (default), and `lg` — on the shared ' + 'control scale.',
  ),
};

export const CustomContent: Story = {
  render: () => ({
    template: stack(`
      <lib-progress-bar [value]="30" ariaLabel="File sync">3 of 10 files</lib-progress-bar>
      <lib-progress-bar [value]="80" unit=" MB" ariaLabel="Download size" />
    `),
  }),
  parameters: doc(
    'Project content to replace the built-in percentage with your own label ' +
      '(first bar), or keep the built-in value and change the `unit` (second).',
  ),
};

export const Accessibility: Story = {
  render: () => ({
    template: stack(`
      <lib-progress-bar [value]="45" ariaLabel="Upload progress" />
      <span id="report-label">Report generation</span>
      <lib-progress-bar [value]="45" ariaLabelledby="report-label" />
      <lib-progress-bar [value]="45" />
    `),
  }),
  parameters: doc(
    [
      'The host carries `role="progressbar"` with `aria-valuemin="0"`, ' +
        '`aria-valuemax="100"`, and `aria-valuenow` (omitted while ' +
        'indeterminate).',
      '',
      '- **Name the bar** with `ariaLabel` or `ariaLabelledby` — the visible ' +
        'percentage is a value, not an accessible name. `role="progressbar"` ' +
        'takes its name from the author only, so nothing else can supply one.',
      '- With neither (the third bar above), it falls back to the lib’s own ' +
        'translated `Progress` / `Loading` rather than reporting nothing. ' +
        'Passing both is not a way to say more: `aria-labelledby` wins the ' +
        'name computation, so `aria-label` is dropped instead of left to ' +
        'compete.',
      '- Fill colours meet **WCAG AA** contrast against the track in both ' +
        'themes, and a forced palette keeps the fill distinct from the track.',
      '- Respects `prefers-reduced-motion`: the indeterminate animation is ' +
        'replaced by a static state.',
    ].join('\n'),
  ),
};
