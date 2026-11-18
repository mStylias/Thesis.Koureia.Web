import { Component, input, signal } from '@angular/core';
import { form, FormField, minLength, required } from '@angular/forms/signals';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { FloatLabel, IftaLabel } from '@ui/form-field';
import { Textarea } from './textarea';
import { TextareaResize, TextareaSize } from './textarea.types';

const SIZES = ['sm', 'md', 'lg'] as const;

/**
 * A per-story description plus the snippet shown under "Show code".
 *
 * The snippet has to be written by hand: every story renders through a
 * demo wrapper component, because a story object cannot hold the signals
 * these examples need. Storybook's generated source would therefore read
 * `<lib-textarea-demo />` — the scaffolding, not the API. Overriding
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

@Component({
  selector: 'lib-textarea-demo',
  imports: [Textarea],
  template: `
    <textarea
      libTextarea
      [size]="size()"
      [invalid]="invalid()"
      [disabled]="disabled()"
      [resize]="resize()"
      [autoResize]="autoResize()"
      [placeholder]="placeholder()"
      aria-label="Notes"
      rows="3"
    ></textarea>
  `,
})
class TextareaDemo {
  readonly size = input<TextareaSize>('md');
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly resize = input<TextareaResize>('vertical');
  readonly autoResize = input(false);
  readonly placeholder = input('Add your notes');
}

@Component({
  selector: 'lib-textarea-sizes-demo',
  imports: [Textarea],
  template: `
    <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; align-items: flex-start;">
      @for (size of sizes; track size) {
        <textarea
          libTextarea
          [size]="size"
          [placeholder]="'Size ' + size"
          [attr.aria-label]="'Size ' + size"
          rows="3"
        ></textarea>
      }
    </div>
  `,
})
class TextareaSizesDemo {
  protected readonly sizes = SIZES;
}

@Component({
  selector: 'lib-textarea-resize-demo',
  imports: [Textarea],
  template: `
    <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; align-items: flex-start;">
      <textarea
        libTextarea
        resize="vertical"
        placeholder="resize: vertical (default)"
        aria-label="Vertical resize"
        rows="3"
      ></textarea>
      <textarea
        libTextarea
        resize="none"
        placeholder="resize: none"
        aria-label="No resize"
        rows="3"
      ></textarea>
      <textarea
        libTextarea
        resize="both"
        placeholder="resize: both"
        aria-label="Both resize"
        rows="3"
      ></textarea>
    </div>
  `,
})
class TextareaResizeDemo {}

@Component({
  selector: 'lib-textarea-auto-resize-demo',
  imports: [Textarea],
  template: `
    <textarea
      libTextarea
      autoResize
      placeholder="Type across several lines and watch it grow…"
      aria-label="Auto-resizing notes"
      style="max-width: 24rem;"
      rows="2"
    ></textarea>
  `,
})
class TextareaAutoResizeDemo {}

@Component({
  selector: 'lib-textarea-labels-demo',
  imports: [Textarea, FloatLabel, IftaLabel],
  template: `
    <div style="display: flex; gap: var(--space-8); flex-wrap: wrap; padding-top: var(--space-6);">
      <div libFloatLabel>
        <textarea libTextarea id="ta-over" placeholder=" " rows="3"></textarea>
        <label for="ta-over">Notes (over)</label>
      </div>

      <div libFloatLabel variant="in">
        <textarea libTextarea id="ta-in" placeholder=" " rows="3"></textarea>
        <label for="ta-in">Notes (in)</label>
      </div>

      <div libIftaLabel>
        <textarea libTextarea id="ta-ifta" placeholder=" " rows="3">Kimonas</textarea>
        <label for="ta-ifta">Notes (IFTA)</label>
      </div>
    </div>
  `,
})
class TextareaLabelsDemo {}

@Component({
  selector: 'lib-textarea-signal-forms-demo',
  imports: [Textarea, FormField],
  template: `
    <form style="display: flex; flex-direction: column; gap: var(--space-2); max-width: 24rem;">
      <textarea
        libTextarea
        autoResize
        [formField]="bookingForm.notes"
        placeholder="Special requests"
        aria-label="Special requests"
        rows="2"
      ></textarea>

      @if (bookingForm.notes().touched() && bookingForm.notes().errors().length) {
        <span style="color: var(--error-text); font-size: var(--text-sm);">
          {{ bookingForm.notes().errors()[0].message }}
        </span>
      }

      <span style="color: var(--text-secondary); font-size: var(--text-sm);">
        valid: {{ bookingForm.notes().valid() }}
      </span>
    </form>
  `,
})
class TextareaSignalFormsDemo {
  protected readonly model = signal({ notes: '' });
  protected readonly bookingForm = form(this.model, (schemaPath) => {
    required(schemaPath.notes, { message: 'Notes are required' });
    minLength(schemaPath.notes, 10, { message: 'At least 10 characters' });
  });
}

const meta: Meta<TextareaDemo> = {
  title: 'Forms & input/Textarea',
  component: TextareaDemo,
  decorators: [
    moduleMetadata({
      imports: [
        TextareaDemo,
        TextareaSizesDemo,
        TextareaResizeDemo,
        TextareaAutoResizeDemo,
        TextareaLabelsDemo,
        TextareaSignalFormsDemo,
      ],
    }),
  ],
  argTypes: {
    size: { control: 'select', options: SIZES },
    invalid: { control: 'boolean' },
    disabled: { control: 'boolean' },
    resize: { control: 'select', options: ['vertical', 'none', 'both'] },
    autoResize: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  args: {
    size: 'md',
    invalid: false,
    disabled: false,
    resize: 'vertical',
    autoResize: false,
    placeholder: 'Add your notes',
  },
};

export default meta;
type Story = StoryObj<TextareaDemo>;

/**
 * Interactive sandbox — flip any option with the controls below to preview
 * every combination. The rest of this page documents each feature in isolation.
 */
export const Basic: Story = {
  parameters: doc(
    'Use the **Controls** tab to combine `size`, `invalid`, `disabled`, ' +
      '`resize`, `autoResize`, and `placeholder`. Every other example on ' +
      'this page isolates one feature so you can see its effect on its own.',
    `
<textarea libTextarea rows="3" placeholder="Add your notes" aria-label="Notes"></textarea>
`,
  ),
};

export const Sizes: Story = {
  render: () => ({ template: '<lib-textarea-sizes-demo />' }),
  parameters: doc(
    'Three control heights — `sm`, `md` (default), and `lg` — matching the ' +
      'shared form-control sizes so the textarea aligns with inputs and ' +
      'buttons.',
    `
<textarea libTextarea size="sm" rows="3" aria-label="Small"></textarea>
<textarea libTextarea size="md" rows="3" aria-label="Medium"></textarea>
<textarea libTextarea size="lg" rows="3" aria-label="Large"></textarea>
`,
  ),
};

export const Invalid: Story = {
  args: { invalid: true },
  parameters: doc(
    'Set `invalid` to show the error styling. It also reflects ' +
      '`aria-invalid="true"` on the native textarea so assistive tech ' +
      'announces the field as invalid. The control renders no message of ' +
      'its own — supply one and point `aria-describedby` at it.',
    `
<textarea
  libTextarea
  invalid
  rows="3"
  aria-label="Notes"
  aria-describedby="notes-error"></textarea>
<p id="notes-error">Notes are required</p>
`,
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: doc(
    'The native `disabled` attribute blocks interaction and greys the ' +
      'control. This is the standard attribute on the underlying ' +
      '`<textarea>`, not a component input — and so is `readonly`, which ' +
      'keeps the value readable and focusable but withholds the hover ' +
      'border, since hover promises an edit.',
    `
<textarea libTextarea disabled rows="3" aria-label="Notes"></textarea>
<textarea libTextarea readonly rows="3" aria-label="Notes">Read me</textarea>
`,
  ),
};

export const Resize: Story = {
  render: () => ({ template: '<lib-textarea-resize-demo />' }),
  parameters: doc(
    'The `resize` input maps to the CSS `resize` property: `vertical` ' +
      '(default), `none`, or `both`. Drag the handle in the corner to ' +
      'resize where allowed.',
    `
<textarea libTextarea resize="vertical" rows="3" aria-label="Notes"></textarea>
<textarea libTextarea resize="none" rows="3" aria-label="Notes"></textarea>
<textarea libTextarea resize="both" rows="3" aria-label="Notes"></textarea>
`,
  ),
};

export const AutoResize: Story = {
  render: () => ({ template: '<lib-textarea-auto-resize-demo />' }),
  parameters: doc(
    'Add `autoResize` and the textarea grows to fit its content on every ' +
      'edit, hiding the scrollbar and the manual resize handle. It also ' +
      're-fits after programmatic writes (Signal Forms binding/reset), so ' +
      'pre-filled values size correctly on load — and skips the measurement ' +
      'entirely while neither the content nor the width has moved, so the ' +
      'render hook cannot thrash layout.',
    `
<textarea
  libTextarea
  autoResize
  rows="2"
  placeholder="Grows as you type"
  aria-label="Notes"></textarea>
`,
  ),
};

export const Labels: Story = {
  render: () => ({ template: '<lib-textarea-labels-demo />' }),
  parameters: doc(
    'Compose with the label wrappers from `@ui/form-field`. ' +
      '`libFloatLabel` (variants `over`, `in`, `on`) floats a `<label>` ' +
      'that settles into the field, and `libIftaLabel` keeps the label ' +
      'pinned above the value. Give the textarea `placeholder=" "` so the ' +
      'float label can detect an empty value.',
    `
<div libFloatLabel>
  <textarea libTextarea id="notes" placeholder=" " rows="3"></textarea>
  <label for="notes">Notes</label>
</div>

<div libIftaLabel>
  <textarea libTextarea id="notes-ifta" placeholder=" " rows="3"></textarea>
  <label for="notes-ifta">Notes</label>
</div>
`,
  ),
};

export const SignalForms: Story = {
  render: () => ({ template: '<lib-textarea-signal-forms-demo />' }),
  parameters: doc(
    'Bind `[formField]` to a Signal Forms field and the native textarea ' +
      'mirrors its value both ways. Drive `invalid` from the field state ' +
      '(`touched() && invalid()`) to surface validation only after ' +
      'interaction, and pair it with an error message for the user.',
    `
<textarea
  libTextarea
  autoResize
  rows="2"
  [formField]="bookingForm.notes"
  [invalid]="bookingForm.notes().touched() && bookingForm.notes().invalid()"
  placeholder="Special requests"
  aria-label="Special requests"
  aria-describedby="notes-error"></textarea>

@if (bookingForm.notes().touched() && bookingForm.notes().errors().length) {
  <span id="notes-error">{{ bookingForm.notes().errors()[0].message }}</span>
}
`,
  ),
};

export const Accessibility: Story = {
  render: () => ({ template: '<lib-textarea-labels-demo />' }),
  parameters: doc(
    [
      'The component renders a **native** `<textarea>`, so it inherits the ' +
        'correct role, focus behavior, and keyboard handling for free.',
      '',
      '- **Always give the textarea an accessible name** — associate a ' +
        '`<label for>` (see the label wrappers) or, failing that, an ' +
        '`aria-label`.',
      '- **A `placeholder` is not a label** — it disappears on input and ' +
        'can fail contrast, so never rely on it as the only name.',
      '- **`invalid`** reflects `aria-invalid="true"`; pair it with an ' +
        'error message referenced by `aria-describedby` so the reason is ' +
        'announced.',
      '- Use `aria-describedby` to link hint or helper text to the textarea.',
      '- The **disabled** state uses the native `disabled` attribute, which ' +
        'assistive tech announces and which is removed from the tab order. ' +
        '`readonly` stays focusable and readable but withholds the hover ' +
        'border, since hover promises an edit.',
      '- Focus rings and color contrast meet **WCAG AA** in both light and ' +
        'dark themes, including the invalid state, and a `forced-colors` ' +
        'block re-states the border and focus ring that a forced palette ' +
        'would otherwise drop along with the box-shadow.',
    ].join('\n'),
    `
<!-- Named by a visible label -->
<div libFloatLabel>
  <textarea libTextarea id="notes" placeholder=" " rows="3"></textarea>
  <label for="notes">Notes</label>
</div>

<!-- Named directly, with a hint associated -->
<textarea
  libTextarea
  rows="3"
  aria-label="Notes"
  aria-describedby="notes-hint"></textarea>
<p id="notes-hint">Anything the barber should know beforehand</p>
`,
  ),
};
