import { Component } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { FloatLabel } from './float-label/float-label';
import { IftaLabel } from './ifta-label/ifta-label';

// Plain input styling for the demos only — real apps style their own
// controls; the label wrappers are control-agnostic.
//
// The top padding MUST route through --field-pad-top, exactly as every
// design-system control does. A component's own `padding` shorthand has the
// same specificity as the wrapper's `[libIftaLabel] > input` rule and is
// injected after it, so it wins — and the label then sits on top of the
// value instead of above it.
const INPUT_STYLE = `
  input {
    font-family: var(--font-sans);
    font-size: var(--text-base);
    color: var(--text-primary);
    background: var(--surface);
    border: var(--border-width-hairline) solid var(--border-strong);
    border-radius: var(--radius-md);
    padding: var(--field-pad-top, var(--space-2)) var(--space-3) var(--space-2);
    width: 16rem;
  }
`;

@Component({
  selector: 'lib-float-label-demo',
  imports: [FloatLabel],
  styles: INPUT_STYLE,
  template: `
    <div style="display: flex; gap: var(--space-8); flex-wrap: wrap; padding-top: var(--space-6);">
      <div libFloatLabel>
        <input id="fl-over" type="text" placeholder=" " />
        <label for="fl-over">Over (default)</label>
      </div>

      <div libFloatLabel variant="in">
        <input id="fl-in" type="text" placeholder=" " />
        <label for="fl-in">In</label>
      </div>

      <div libFloatLabel variant="on">
        <input id="fl-on" type="text" placeholder=" " />
        <label for="fl-on">On</label>
      </div>
    </div>
  `,
})
class FloatLabelDemo {}

@Component({
  selector: 'lib-ifta-label-demo',
  imports: [IftaLabel],
  styles: INPUT_STYLE,
  template: `
    <div style="display: flex; gap: var(--space-8); flex-wrap: wrap;">
      <div libIftaLabel>
        <input id="ifta-email" type="email" placeholder=" " />
        <label for="ifta-email">Email</label>
      </div>

      <div libIftaLabel>
        <input id="ifta-invalid" type="text" aria-invalid="true" value="!!" />
        <label for="ifta-invalid">Booking code (invalid)</label>
      </div>
    </div>
  `,
})
class IftaLabelDemo {}

@Component({
  selector: 'lib-form-field-tokens-demo',
  imports: [FloatLabel],
  styles: INPUT_STYLE,
  template: `
    <div style="display: flex; gap: var(--space-8); flex-wrap: wrap; padding-top: var(--space-6);">
      <div libFloatLabel variant="on" style="--field-label-inset: var(--space-5)">
        <input id="fl-inset" type="text" placeholder=" " />
        <label for="fl-inset">Wider inset</label>
      </div>

      <div
        style="padding: var(--space-4); background: var(--surface-2); border-radius: var(--radius-md);"
      >
        <div libFloatLabel variant="on" style="--field-label-bg: var(--surface-2)">
          <input id="fl-bg" type="text" placeholder=" " />
          <label for="fl-bg">On a panel</label>
        </div>
      </div>
    </div>
  `,
})
class FormFieldTokensDemo {}

/**
 * Shorthand for a per-story description in the autodocs page. The source
 * override is required: every example renders through a demo component,
 * so "Show code" would otherwise print `<lib-*-demo />` rather than the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const meta: Meta = {
  title: 'Forms & input/Form field',
  decorators: [
    moduleMetadata({
      imports: [FloatLabelDemo, IftaLabelDemo, FormFieldTokensDemo],
    }),
  ],
};

export default meta;
type Story = StoryObj;

/**
 * The form-field label wrappers are applied as attributes on the wrapping
 * element you already write, so they add no extra DOM and stay
 * control-agnostic — the control keeps its own `id` and the `<label>` its
 * `for`, and the wrapper only handles the label's motion and placement.
 */
export const FloatLabelVariants: Story = {
  render: () => ({ template: '<lib-float-label-demo />' }),
  parameters: doc(
    'Apply `libFloatLabel` to a wrapper to float its `<label>` over the ' +
      'control, moving it out of the way once the control is focused or ' +
      'filled. The `variant` input picks where it lands: `over` the top ' +
      'border (default), `in`side the control, or `on` the border line. ' +
      'Native `input`/`textarea` report the filled state via ' +
      '`placeholder=" "`; design-system controls report it through the ' +
      '`data-filled` host attribute — the `:placeholder-shown` trick is ' +
      'matched on direct children only, so a control that renders its own ' +
      'inner input is never mistaken for a filled one.',
    `
<div libFloatLabel>
  <input id="fl-over" type="text" placeholder=" " />
  <label for="fl-over">Over (default)</label>
</div>

<div libFloatLabel variant="in">
  <input id="fl-in" type="text" placeholder=" " />
  <label for="fl-in">In</label>
</div>

<div libFloatLabel variant="on">
  <input id="fl-on" type="text" placeholder=" " />
  <label for="fl-on">On</label>
</div>

<!-- A design-system control reports "filled" through its host attribute -->
<div libFloatLabel>
  <lib-select inputId="fl-city" [options]="cities" [(value)]="city" />
  <label for="fl-city">City</label>
</div>
`,
  ),
};

export const IftaLabels: Story = {
  render: () => ({ template: '<lib-ifta-label-demo />' }),
  parameters: doc(
    'Apply `libIftaLabel` for an IFTA (infield top-aligned) label that sits ' +
      'permanently small at the top of the control while the value renders ' +
      'below it. Unlike a float label it never moves, so it stays readable ' +
      'even when the control is filled. Setting `aria-invalid="true"` on the ' +
      'control drives the invalid styling.',
    `
<div libIftaLabel>
  <input id="ifta-email" type="email" placeholder=" " />
  <label for="ifta-email">Email</label>
</div>

<div libIftaLabel>
  <input id="ifta-invalid" type="text" aria-invalid="true" value="!!" />
  <label for="ifta-invalid">Booking code (invalid)</label>
</div>
`,
  ),
};

export const CustomProperties: Story = {
  render: () => ({ template: '<lib-form-field-tokens-demo />' }),
  parameters: doc(
    'Both wrappers read `--field-label-inset` (horizontal offset, to line ' +
      'the label up with a `sm`/`lg` field) and, for the float `on` ' +
      'variant, `--field-label-bg` (the mask behind the notch). Set them on ' +
      'the **wrapper**: the label is the control’s sibling, and custom ' +
      'properties only inherit downward, so setting them from a control ' +
      '`:host` is dead code.',
    `
<div libFloatLabel variant="on" style="--field-label-inset: var(--space-5)">
  <input id="fl-inset" type="text" placeholder=" " />
  <label for="fl-inset">Wider inset</label>
</div>

<!-- Field on a --surface-2 panel: the notch mask has to match -->
<div libFloatLabel variant="on" style="--field-label-bg: var(--surface-2)">
  <input id="fl-bg" type="text" placeholder=" " />
  <label for="fl-bg">On a panel</label>
</div>
`,
  ),
};

export const Accessibility: Story = {
  render: () => ({
    template: `
      <lib-float-label-demo />
      <lib-ifta-label-demo />
    `,
  }),
  parameters: doc(
    [
      'Both wrappers are layout-only and rely on you writing a real ' +
        '`<label>` and control, so accessible names come from native markup ' +
        'rather than anything the wrapper injects.',
      '',
      '- **Associate the label with the control** — give the control an `id` ' +
        'and the `<label>` a matching `for`, so clicking the label focuses ' +
        'the control and screen readers announce the name.',
      '- **The label text stays a persistent, visible name** in every float ' +
        'variant and for IFTA labels — it is not a placeholder that ' +
        'disappears on input.',
      '- **Invalid state is conveyed to assistive tech** via ' +
        '`aria-invalid="true"` (or the `data-invalid` host attribute), not by ' +
        'color alone.',
      '- Label and control text meet **WCAG AA** contrast in both light and ' +
        'dark themes, including the floated and infield positions.',
      '- While the label overlaps the control it is `pointer-events: none`, ' +
        'so a click on the overlapped area reaches the control instead of ' +
        'being swallowed by the label.',
    ].join('\n'),
    `
<!-- The wrapper adds no semantics: the id/for pair is what names the control -->
<div libFloatLabel>
  <input id="fl-name" type="text" placeholder=" " />
  <label for="fl-name">Name</label>
</div>

<div libIftaLabel>
  <input id="ifta-code" type="text" aria-invalid="true" value="!!" />
  <label for="ifta-code">Booking code</label>
</div>
`,
  ),
};
