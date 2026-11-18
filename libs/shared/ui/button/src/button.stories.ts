import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { LucideSave } from '@lucide/angular';
import { Button, ButtonIcon } from './button';

const SEVERITIES = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const;

/** A per-story description and the consumer-facing snippet shown by Storybook. */
const doc = (markdown: string, code: string) => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language: 'html' },
  },
});

const severitySource = (variant: string) =>
  SEVERITIES.map(
    (severity) =>
      `<button libButton severity="${severity}" variant="${variant}">${severity}</button>`,
  ).join('\n');

const meta: Meta<Button> = {
  title: 'Actions/Button',
  component: Button,
  decorators: [moduleMetadata({ imports: [Button, ButtonIcon, LucideSave] })],
  argTypes: {
    severity: { control: 'select', options: SEVERITIES },
    variant: { control: 'select', options: ['filled', 'outlined', 'text'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    iconOnly: { control: 'boolean' },
    rounded: { control: 'boolean' },
    raised: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    severity: 'primary',
    variant: 'filled',
    size: 'md',
    iconOnly: false,
    rounded: false,
    raised: false,
    disabled: false,
  },
  render: (args) => ({
    props: args,
    template: `
      <button libButton
        [severity]="severity" [variant]="variant" [size]="size"
        [iconOnly]="iconOnly" [rounded]="rounded" [raised]="raised"
        [disabled]="disabled"
      >Book now</button>
    `,
  }),
};

export default meta;
type Story = StoryObj<Button>;

/**
 * Interactive sandbox — flip any input with the controls below to preview
 * every combination. The rest of this page documents each input in isolation.
 */
export const Playground: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine any inputs. Every other example ' +
      'on this page isolates one input so you can see its effect on its own.',
    '<button libButton severity="primary" variant="filled" size="md">Book now</button>',
  ),
};

const row = (buttons: string) =>
  `<div style="display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;">${buttons}</div>`;

const severityRow = (variant: string) =>
  row(
    SEVERITIES.map(
      (severity) =>
        `<button libButton severity="${severity}" variant="${variant}">${severity}</button>`,
    ).join(''),
  );

export const Filled: Story = {
  render: () => ({ template: severityRow('filled') }),
  parameters: doc(
    'The default `variant`. Solid fill in the severity color — use for the ' +
      'single primary action in a view.',
    severitySource('filled'),
  ),
};

export const Outlined: Story = {
  render: () => ({ template: severityRow('outlined') }),
  parameters: doc(
    'A transparent fill with a colored border. Use for secondary actions ' +
      'that should stay visually lighter than a filled button.',
    severitySource('outlined'),
  ),
};

export const Text: Story = {
  render: () => ({ template: severityRow('text') }),
  parameters: doc(
    'No fill or border — just the label. Use for the lowest-emphasis ' +
      'actions, such as inline or tertiary controls.',
    severitySource('text'),
  ),
};

export const Sizes: Story = {
  render: () => ({
    template: row(`
      <button libButton size="sm">Book now</button>
      <button libButton size="md">Book now</button>
      <button libButton size="lg">Book now</button>
    `),
  }),
  parameters: doc(
    'Three control heights — `sm`, `md` (default), and `lg` — matching the ' +
      'shared form-control sizes so buttons align with inputs on the same row.',
    `
<button libButton size="sm">Book now</button>
<button libButton size="md">Book now</button>
<button libButton size="lg">Book now</button>
    `,
  ),
};

export const IconOnly: Story = {
  render: () => ({
    template: row(`
      <button libButton iconOnly size="sm" aria-label="Favorite">★</button>
      <button libButton iconOnly aria-label="Favorite">★</button>
      <button libButton iconOnly rounded size="lg" aria-label="Favorite">★</button>
      <button libButton iconOnly rounded variant="outlined" aria-label="Favorite">★</button>
    `),
  }),
  parameters: doc(
    'Set `iconOnly` for an equal width/height control holding a single icon. ' +
      'It has no text label, so an **`aria-label` is required** for screen readers.',
    `
<button libButton iconOnly size="sm" aria-label="Favorite">★</button>
<button libButton iconOnly aria-label="Favorite">★</button>
<button libButton iconOnly rounded size="lg" aria-label="Favorite">★</button>
    `,
  ),
};

export const Rounded: Story = {
  render: () => ({
    template: row(`
      <button libButton rounded>Book now</button>
      <button libButton rounded variant="outlined" severity="secondary">Cancel</button>
    `),
  }),
  parameters: doc(
    'Set `rounded` for a fully pill-shaped button (or a circle when combined ' +
      'with `iconOnly`).',
    `
<button libButton rounded>Book now</button>
<button libButton rounded variant="outlined" severity="secondary">Cancel</button>
    `,
  ),
};

export const Raised: Story = {
  render: () => ({
    template: row(`
      <button libButton raised>Book now</button>
      <button libButton raised severity="secondary">Cancel</button>
    `),
  }),
  parameters: doc(
    'Set `raised` to add an elevation shadow, lifting the button off the ' +
      'surface for extra prominence.',
    `
<button libButton raised>Book now</button>
<button libButton raised severity="secondary">Cancel</button>
    `,
  ),
};

export const Disabled: Story = {
  render: () => ({
    template: row(`
      <button libButton disabled>Book now</button>
      <button libButton disabled variant="outlined">Book now</button>
      <button libButton disabled variant="text">Book now</button>
      <a libButton href="/booking" disabled>View booking</a>
    `),
  }),
  parameters: doc(
    'Set `disabled` to block interaction. On `<a>` hosts — which have no ' +
      'native `disabled` — it also applies `aria-disabled` so assistive tech ' +
      'announces the state correctly.',
    `
<button libButton disabled>Book now</button>
<button libButton disabled variant="outlined">Book now</button>
<button libButton disabled variant="text">Book now</button>
<a libButton href="/booking" disabled>View booking</a>
    `,
  ),
};

export const Loading: Story = {
  render: () => ({
    template: row(`
      <button libButton [loading]="true">
        <svg lucideSave libButtonIcon aria-hidden="true"></svg>
        Save
      </button>
      <button libButton [loading]="true" variant="outlined">Save</button>
      <button libButton [loading]="true" iconOnly aria-label="Save"></button>
    `),
  }),
  parameters: doc(
    'Set `loading` while an action of this button is in flight. It draws a ' +
      'spinner, reports `aria-busy`, and blocks interaction — there is no need ' +
      'to set `disabled` as well. Mark the icon it replaces with ' +
      '`libButtonIcon`, or the spinner is drawn before the icon and the button ' +
      'grows by one icon mid-action. **The caption stays put**: the button holds ' +
      'focus after a press, and a name that changes there is re-announced ' +
      'mid-interaction, so anything the user must read instead belongs in a toast.',
    `
<button libButton [loading]="saving()">
  <svg lucideSave libButtonIcon aria-hidden="true"></svg>
  Save
</button>
    `,
  ),
};

export const Link: Story = {
  render: () => ({
    template: row(`
      <a libButton href="/booking">View booking</a>
      <a libButton href="/booking" severity="secondary" variant="outlined">History</a>
      <a libButton href="/booking" variant="text">Details</a>
    `),
  }),
  parameters: doc(
    'Apply `libButton` to an `<a>` to make a link look like a button while ' +
      'keeping native anchor semantics — right-click, open-in-new-tab, and ' +
      'keyboard navigation all keep working. Use this when the action ' +
      'navigates; use `<button>` when it performs an action in place.',
    `
<a libButton href="/booking">View booking</a>
<a libButton href="/booking" severity="secondary" variant="outlined">History</a>
<a libButton href="/booking" variant="text">Details</a>
    `,
  ),
};

export const Accessibility: Story = {
  render: () => ({
    template: row(`
      <button libButton iconOnly rounded aria-label="Add to favorites">★</button>
      <a libButton href="/booking" variant="outlined">View booking</a>
      <button libButton disabled>Unavailable</button>
    `),
  }),
  parameters: doc(
    [
      'The component renders a **native** `<button>` or `<a>`, so it inherits ' +
        'the correct role, focus behavior, and `Enter`/`Space` activation for ' +
        'free.',
      '',
      '- **Icon-only buttons must have an `aria-label`** — there is no visible ' +
        'text for screen readers to announce.',
      '- **Disabled `<a>` hosts** get `aria-disabled="true"` in addition to the ' +
        '`disabled` attribute, since anchors have no native disabled state.',
      '- Focus rings and color contrast meet **WCAG AA** in both light and ' +
        'dark themes across every severity and variant.',
    ].join('\n'),
    `
<button libButton iconOnly rounded aria-label="Add to favorites">★</button>
<a libButton href="/booking" variant="outlined">View booking</a>
<button libButton disabled>Unavailable</button>
    `,
  ),
};
