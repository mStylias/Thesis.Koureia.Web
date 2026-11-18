import { Component, signal } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '@ui/button';
import { PopoverTrigger } from './popover-trigger';

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * Every story renders through a demo wrapper, because a story object
 * cannot hold the signals these examples need — so Storybook's generated
 * source would read `<lib-popover-basic-demo />`, the scaffolding rather
 * than the API. The trade-off is that the snippet is static, so keep it
 * in step with the demos above.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

@Component({
  selector: 'lib-popover-basic-demo',
  imports: [Button, PopoverTrigger],
  template: `
    <button libButton [libPopoverTriggerFor]="info" popoverAriaLabel="Shop hours">
      Opening hours
    </button>
    <ng-template #info>
      <h3
        style="margin: 0 0 var(--space-2); font-family: var(--font-display); font-size: var(--text-lg);"
      >
        Opening hours
      </h3>
      <dl
        style="display: grid; grid-template-columns: auto auto; gap: var(--space-1) var(--space-6); margin: 0; font-family: var(--font-mono); font-size: var(--text-sm);"
      >
        <dt>Mon–Fri</dt>
        <dd style="margin: 0;">09:00 – 20:00</dd>
        <dt>Saturday</dt>
        <dd style="margin: 0;">09:00 – 18:00</dd>
        <dt>Sunday</dt>
        <dd style="margin: 0;">Closed</dd>
      </dl>
    </ng-template>
  `,
})
class PopoverBasicDemo {}

@Component({
  selector: 'lib-popover-form-demo',
  imports: [Button, PopoverTrigger],
  template: `
    <button libButton variant="outlined" [libPopoverTriggerFor]="note">Add a note</button>
    <ng-template #note>
      <label
        for="popover-note"
        style="display: block; margin-bottom: var(--space-2); font-weight: var(--weight-bold);"
      >
        Note for the barber
      </label>
      <textarea
        id="popover-note"
        rows="3"
        [value]="text()"
        (input)="text.set($any($event.target).value)"
        style="width: 16rem; max-width: 100%; box-sizing: border-box; padding: var(--space-2); border: var(--border-width-hairline) solid var(--border-strong); border-radius: var(--radius-md); font: inherit;"
      ></textarea>
      <p
        style="margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: var(--text-sm);"
      >
        {{ text().length }} characters
      </p>
    </ng-template>
  `,
})
class PopoverFormDemo {
  protected readonly text = signal('');
}

@Component({
  selector: 'lib-popover-position-demo',
  imports: [Button, PopoverTrigger],
  template: `
    <div style="display: flex; gap: var(--space-4);">
      <button libButton [libPopoverTriggerFor]="below">Opens below</button>
      <button libButton severity="secondary" popoverPosition="top" [libPopoverTriggerFor]="above">
        Opens above
      </button>
    </div>
    <ng-template #below><p style="margin: 0;">Anchored below the trigger.</p></ng-template>
    <ng-template #above><p style="margin: 0;">Anchored above the trigger.</p></ng-template>
  `,
})
class PopoverPositionDemo {}

@Component({
  selector: 'lib-popover-disabled-demo',
  imports: [Button, PopoverTrigger],
  template: `
    <button libButton [libPopoverTriggerFor]="info" popoverDisabled>No popover</button>
    <ng-template #info><p style="margin: 0;">Never reached.</p></ng-template>
  `,
})
class PopoverDisabledDemo {}

const meta: Meta<PopoverBasicDemo> = {
  title: 'Overlays/Popover',
  component: PopoverBasicDemo,
  decorators: [
    moduleMetadata({
      imports: [PopoverBasicDemo, PopoverFormDemo, PopoverPositionDemo, PopoverDisabledDemo],
    }),
  ],
};

export default meta;
type Story = StoryObj<PopoverBasicDemo>;

/**
 * An element-anchored overlay holding arbitrary content, opened with
 * the `libPopoverTriggerFor` directive. Click toggles it; it closes on
 * outside pointerdown, Escape (restoring focus to the trigger), and
 * scroll. The surface has `role="dialog"` and focus moves into it on
 * open. Equivalent in principle to PrimeNG's Popover.
 */
export const Basic: Story = {
  parameters: doc(
    'The trigger is any element — give it the directive and a content ' +
      '`ng-template`. `popoverAriaLabel` names the dialog; without it (or ' +
      '`popoverAriaLabelledby`) the surface is named by the trigger itself, ' +
      'so it is never announced unnamed.',
    `
<button libButton [libPopoverTriggerFor]="info" popoverAriaLabel="Shop hours">
  Opening hours
</button>

<ng-template #info>
  <h3>Opening hours</h3>
  <dl>
    <dt>Mon–Fri</dt><dd>09:00 – 20:00</dd>
    <dt>Saturday</dt><dd>09:00 – 18:00</dd>
    <dt>Sunday</dt><dd>Closed</dd>
  </dl>
</ng-template>
    `,
  ),
};

/**
 * Popovers hold interactive content — focus moves to the first
 * focusable element on open, and the popover stays open while you
 * interact inside it.
 */
export const WithForm: Story = {
  render: () => ({ template: '<lib-popover-form-demo />' }),
  parameters: doc(
    'Focus moves to the first focusable element in the surface on open, ' +
      'and the popover stays open while you interact inside it. **This is ' +
      'why a field-attached hint must use `PopoverService` directly** — the ' +
      'trigger would take focus off whatever the user is typing into.',
    `
<button libButton variant="outlined" [libPopoverTriggerFor]="note">Add a note</button>

<ng-template #note>
  <label for="popover-note">Note for the barber</label>
  <textarea id="popover-note" rows="3" [value]="text()"
            (input)="text.set($any($event.target).value)"></textarea>
  <p>{{ text().length }} characters</p>
</ng-template>
    `,
  ),
};

/**
 * `popoverPosition` sets the preferred side; the popover flips to the
 * opposite side when it does not fit the viewport.
 */
export const Positioning: Story = {
  render: () => ({ template: '<lib-popover-position-demo />' }),
  parameters: doc(
    '`popoverPosition` sets the preferred side; the popover flips to the ' +
      'opposite one when it does not fit, and the surface keeps its ' +
      '`transform-origin` on whichever side it actually landed on. The ' +
      'primitive behind this — `PopoverService` — also powers the menu and ' +
      'context-menu, and supports point anchoring and re-anchoring a shared ' +
      'instance across triggers.',
    `
<button libButton [libPopoverTriggerFor]="below">Opens below</button>
<button libButton popoverPosition="top" [libPopoverTriggerFor]="above">Opens above</button>

<ng-template #below><p>Anchored below the trigger.</p></ng-template>
<ng-template #above><p>Anchored above the trigger.</p></ng-template>
    `,
  ),
};

/**
 * A disabled trigger opens nothing — and advertises nothing: no
 * `aria-haspopup`, no `aria-expanded`.
 */
export const Disabled: Story = {
  render: () => ({ template: '<lib-popover-disabled-demo />' }),
  parameters: doc(
    'Set `popoverDisabled` to suppress the popover without removing the ' +
      'directive. The trigger drops `aria-haspopup` and `aria-expanded` with ' +
      'it: announcing a dialog the user cannot open is the same failure as a ' +
      'disabled state that does not disable.',
    `
<button libButton [libPopoverTriggerFor]="info" popoverDisabled>No popover</button>
<ng-template #info><p>Never reached.</p></ng-template>
    `,
  ),
};
