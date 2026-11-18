import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Tooltip } from './tooltip';

const POSITIONS = ['top', 'bottom', 'left', 'right'] as const;

/** Shorthand for a per-story description in the autodocs page. */
const doc = (markdown: string) => ({
  docs: { description: { story: markdown } },
});

const meta: Meta<Tooltip> = {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  decorators: [moduleMetadata({ imports: [Tooltip] })],
  argTypes: {
    libTooltip: { control: 'text' },
    tooltipPosition: { control: 'select', options: POSITIONS },
    tooltipDisabled: { control: 'boolean' },
    showDelay: { control: 'number' },
    hideDelay: { control: 'number' },
  },
  args: {
    libTooltip: 'Save changes',
    tooltipPosition: 'top',
    tooltipDisabled: false,
    showDelay: 150,
    hideDelay: 100,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="display: grid; place-items: center; min-height: 10rem;">
        <button
          [libTooltip]="libTooltip"
          [tooltipPosition]="tooltipPosition"
          [tooltipDisabled]="tooltipDisabled"
          [showDelay]="showDelay"
          [hideDelay]="hideDelay"
        >Hover or focus me</button>
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<Tooltip>;

/**
 * Interactive sandbox — hover or focus the trigger and flip any input with
 * the controls below. The rest of this page documents each input in isolation.
 */
export const Playground: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine any inputs, then hover or keyboard-' +
      'focus the trigger to reveal the tooltip. Every other example on this ' +
      'page isolates one input so you can see its effect on its own.',
  ),
};

export const Positions: Story = {
  render: () => ({
    template: `
      <div style="display: flex; gap: var(--space-6); justify-content: center; padding: var(--space-16) 0;">
        ${POSITIONS.map(
          (position) =>
            `<button libTooltip="Tooltip on ${position}" tooltipPosition="${position}">${position}</button>`,
        ).join('')}
      </div>
    `,
  }),
  parameters: doc(
    'Set `tooltipPosition` to `top` (default), `bottom`, `left`, or `right` to ' +
      'pick the preferred side. When that side does not fit the viewport, the ' +
      'tooltip flips to the opposite side automatically.',
  ),
};

export const RichContent: Story = {
  render: () => ({
    template: `
      <div style="display: grid; place-items: center; min-height: 12rem;">
        <ng-template #hours>
          Open <strong>Tue–Sat</strong>, 09:00–19:00
        </ng-template>
        <span [libTooltip]="hours" tabindex="0">Opening hours</span>
      </div>
    `,
  }),
  parameters: doc(
    'Pass a `TemplateRef` to `libTooltip` instead of a string to render rich ' +
      'markup — here **bold** text — in place of plain content. Non-interactive ' +
      'hosts get `tabindex="0"` so the tooltip is reachable by keyboard.',
  ),
};

export const Delayed: Story = {
  render: () => ({
    template: `
      <div style="display: grid; place-items: center; min-height: 10rem;">
        <button libTooltip="Appeared after 500ms" [showDelay]="500">Hover and wait</button>
      </div>
    `,
  }),
  parameters: doc(
    '`showDelay` (ms, default `150`) is the wait before the tooltip appears, so a pointer ' +
      'that only passes over the host shows nothing. A matching `hideDelay` (default `100`) keeps ' +
      'the tooltip open long enough for the pointer to travel onto it.',
  ),
};

export const OnEllipsis: Story = {
  render: () => ({
    template: `
      <div style="display: grid; gap: var(--space-4); justify-items: start; padding: var(--space-10);">
        <span
          libTooltip="Παραδοσιακό κούρεμα με ψαλίδι και ξύρισμα με πετσέτα"
          showOnEllipsis
          tabindex="0"
          style="display: block; max-width: 12rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;"
        >Παραδοσιακό κούρεμα με ψαλίδι και ξύρισμα με πετσέτα</span>
        <span
          libTooltip="This one never shows — the text fits"
          showOnEllipsis
          tabindex="0"
          style="display: block; max-width: 12rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;"
        >Fits fine</span>
      </div>
    `,
  }),
  parameters: doc(
    'Set `showOnEllipsis` to show the tooltip **only when the host text is ' +
      'truncated** with an ellipsis. The first item overflows so its full text ' +
      'appears; the second fits, so no tooltip shows.',
  ),
};

export const Disabled: Story = {
  render: () => ({
    template: `
      <div style="display: grid; place-items: center; min-height: 10rem;">
        <button libTooltip="You should never see this" tooltipDisabled>Nothing on hover</button>
      </div>
    `,
  }),
  parameters: doc(
    'Set `tooltipDisabled` to suppress the tooltip entirely — it will not open ' +
      'on hover or focus.',
  ),
};

export const Accessibility: Story = {
  render: () => ({
    template: `
      <div style="display: grid; place-items: center; min-height: 10rem;">
        <button libTooltip="Save changes">Save</button>
      </div>
    `,
  }),
  parameters: doc(
    [
      'The tooltip is built to meet **WCAG AA**, including the hoverable/' +
        'dismissible requirements of SC 1.4.13 (Content on Hover or Focus).',
      '',
      '- The surface has `role="tooltip"`, and the host gains ' +
        '`aria-describedby` pointing at it while open, so screen readers ' +
        'announce the content with the trigger.',
      '- It shows on **hover and keyboard focus**, and stays open while the ' +
        'pointer is over the tooltip itself so its content stays reachable.',
      '- **`Escape` dismisses** the tooltip without moving the pointer or ' +
        'focus — including one shown by hover alone, where nothing on the ' +
        'host has focus to receive the key. The keystroke is swallowed only ' +
        'while a tooltip is up, so it still reaches an enclosing dialog the ' +
        'rest of the time.',
      '- Treat tooltip text as **supplementary** — never the sole carrier of ' +
        'essential information, since it is not always visible.',
      '- Surface text and background meet AA contrast in both light and dark ' + 'themes.',
    ].join('\n'),
  ),
};
