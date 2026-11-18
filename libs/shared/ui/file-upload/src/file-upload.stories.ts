import { Component, input, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { provideTransloco } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { FileUpload } from './file-upload';
import type { FileUploadHandler, FileUploadMode } from './file-upload.types';

@Component({
  selector: 'lib-file-upload-demo',
  imports: [FileUpload],
  template: `
    <lib-file-upload
      [mode]="mode()"
      [heading]="heading()"
      [description]="description()"
      [chooseLabel]="chooseLabel()"
      [accept]="accept()"
      [multiple]="multiple()"
      [maxFileSize]="maxFileSize()"
      [autoUpload]="autoUpload()"
      [disabled]="disabled()"
      [uploadHandler]="demoUpload"
    />
  `,
})
class FileUploadDemo {
  readonly mode = input<FileUploadMode>('dropzone');
  readonly heading = input('Upload your files');
  readonly description = input(
    'Add images or PDF documents. You can review them before uploading.',
  );
  readonly chooseLabel = input('Choose files');
  readonly accept = input('image/*,.pdf');
  readonly multiple = input(true);
  readonly maxFileSize = input(5 * 1024 * 1024);
  readonly autoUpload = input(false);
  readonly disabled = input(false);

  readonly demoUpload: FileUploadHandler = async ({ reportProgress, signal }) => {
    for (const progress of [20, 40, 60, 80, 100]) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 120));
      if (signal.aborted) {
        throw new DOMException('Upload canceled', 'AbortError');
      }
      reportProgress(progress);
    }
    return { demo: true };
  };
}

@Component({
  selector: 'lib-file-upload-programmatic-demo',
  imports: [FileUpload],
  template: `
    <lib-file-upload #upload mode="simple" [multiple]="true" [uploadHandler]="uploadFile" />
    <p style="margin-top: var(--space-3); color: var(--text-secondary); font-size: var(--text-sm);">
      {{ upload.items().length }} files managed through the public queue API
    </p>
  `,
})
class ProgrammaticDemo {
  readonly uploadFile: FileUploadHandler = ({ reportProgress }) => {
    reportProgress(100);
    return Promise.resolve({ demo: true });
  };
}

@Component({
  selector: 'lib-file-upload-forms-demo',
  imports: [Button, FileUpload, FormField],
  // Capped at a realistic form width — stretched to the viewport the
  // dropzone and queue misrepresent how they lay out.
  template: `
    <form style="max-width: 32rem;" (submit)="onSubmit($event)">
      <lib-file-upload
        mode="simple"
        [formField]="uploadForm.attachments"
        [multiple]="true"
        [uploadHandler]="uploadFile"
      />
      <button libButton type="submit" style="margin-top: var(--space-3);">Submit</button>
    </form>
  `,
})
class SignalFormsDemo {
  protected readonly model = signal<{ attachments: readonly File[] }>({
    attachments: [],
  });

  // `validate` rather than `required`: an empty array is truthy, so the
  // built-in required check would pass on a queue with nothing in it.
  protected readonly uploadForm = form(this.model, (upload) => {
    validate(upload.attachments, ({ value }) =>
      value().length ? undefined : { kind: 'required' },
    );
  });

  protected readonly uploadFile: FileUploadHandler = ({ reportProgress }) => {
    reportProgress(100);
    return Promise.resolve({ demo: true });
  };

  // submit() marks the form touched, which is what surfaces the error for
  // a field the user never focused.
  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.uploadForm, () => Promise.resolve(undefined));
  }
}

const meta: Meta<FileUploadDemo> = {
  title: 'Forms & input/File upload',
  component: FileUploadDemo,
  decorators: [
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
    moduleMetadata({
      imports: [FileUploadDemo, ProgrammaticDemo, SignalFormsDemo],
    }),
  ],
  argTypes: {
    mode: { control: 'select', options: ['simple', 'dropzone'] },
    accept: { control: 'text' },
    multiple: { control: 'boolean' },
    autoUpload: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    mode: 'dropzone',
    heading: 'Upload your files',
    description: 'Add images or PDF documents. You can review them before uploading.',
    chooseLabel: 'Choose files',
    accept: 'image/*,.pdf',
    multiple: true,
    maxFileSize: 5 * 1024 * 1024,
    autoUpload: false,
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<FileUploadDemo>;

/**
 * Shorthand for a per-story description in the autodocs page. The source
 * override is required: every example renders through a demo component, so
 * "Show code" would otherwise print `<lib-file-upload-demo />`.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

export const Dropzone: Story = {
  parameters: doc(
    'The default mode: a drop target with an optional heading and ' +
      'description, the chooser, the constraints spelled out in the hint ' +
      'line, and the queue with previews, per-file progress and row ' +
      'actions. Drop a file or use the button — both run the same ' +
      'validation.',
    `
<lib-file-upload
  uploadUrl="/api/files"
  heading="Upload your files"
  description="Add images or PDF documents."
  accept="image/*,.pdf"
  [multiple]="true"
  [maxFileSize]="5 * 1024 * 1024"
  [maxFiles]="5" />
`,
  ),
};

export const Simple: Story = {
  args: { mode: 'simple' },
  parameters: doc(
    'The compact mode: the same bordered surface with only the chooser. ' +
      'The queue is still tracked — read it from `items()` and the events ' +
      'to render your own workflow.',
    `<lib-file-upload mode="simple" uploadUrl="/api/files" [multiple]="true" />`,
  ),
};

export const AutoUpload: Story = {
  args: { autoUpload: true },
  parameters: doc(
    'With `autoUpload`, a file starts uploading the moment it passes ' +
      'validation, so the queue action row is only a fallback for retries.',
    `<lib-file-upload uploadUrl="/api/files" [autoUpload]="true" [multiple]="true" />`,
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: doc(
    'While `disabled`, the chooser, the drop target and every row action ' +
      'are inert — a control the user cannot edit must not offer a control ' +
      'that edits it. Cancelling an upload already in flight stays ' +
      'available, since stopping is not editing.',
    `<lib-file-upload uploadUrl="/api/files" [disabled]="true" />`,
  ),
};

export const Validation: Story = {
  args: { maxFileSize: 64 * 1024, accept: 'image/*', multiple: true },
  parameters: doc(
    'Rejections are reported in one `role="alert"` block with stable ' +
      '`type`, `size`, `count` and `duplicate` codes on `filesRejected`. ' +
      'The limits are also spelled out up front in the hint line. Zero — or ' +
      'any value that is not a positive finite number — means unlimited.',
    `
<lib-file-upload
  accept="image/*"
  [multiple]="true"
  [maxFileSize]="64 * 1024"
  [maxFiles]="3"
  (filesRejected)="showRejections($event)" />
`,
  ),
};

export const SignalForms: Story = {
  parameters: doc(
    '`[formField]` binds `value`, `disabled`, `invalid`, `touched`, ' +
      '`required` and `errors`. Schema errors render in the same alert ' +
      'block as rejections, but only once the field is touched or focus has ' +
      'left it. `required` shows as a translated word in the hint line — ' +
      'ARIA does not allow `aria-required` on the chooser button’s role, so ' +
      'the requirement is carried as text instead.',
    `
// \`required\` would pass on an empty queue — an empty array is truthy.
const uploadForm = form(model, (upload) => {
  validate(upload.attachments, ({ value }) =>
    value().length ? undefined : { kind: 'required' },
  );
});

// submit() marks the form touched, which is what surfaces the error for
// a field the user never focused.
await submit(uploadForm, () => this.api.save(this.model()));
`,
    'ts',
  ),
  render: () => ({ template: '<lib-file-upload-forms-demo />' }),
};

export const Programmatic: Story = {
  render: () => ({
    template: '<lib-file-upload-programmatic-demo />',
  }),
  parameters: doc(
    'Everything the built-in UI does is on the public API: `choose()`, ' +
      '`addFiles()`, `upload()`, `retry()`, `cancel()`, `remove()` and ' +
      '`clear()`, plus the readonly `items()` and `rejections()` signals.',
    `
<lib-file-upload #upload mode="simple" [multiple]="true" [uploadHandler]="uploadFile" />
<p>{{ upload.items().length }} files managed through the public queue API</p>
`,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    [
      'The native `<input type="file">` is hidden from the a11y tree; the ' +
        'real `<button>` chooser is the focusable control.',
      '',
      '- **The chooser carries the state**: `aria-invalid` while anything is ' +
        'wrong, and an `aria-describedby` pointing at the message block. A ' +
        'consumer’s own `ariaDescribedby` is kept and the control’s ids ' +
        'appended, never replaced.',
      '- **Name the whole control** with `ariaLabel` or `ariaLabelledby`; the ' +
        'host becomes a `role="group"` only when one is supplied.',
      '- **One summarised live region** announces the queue. Per-row status ' +
        'is plain visible text — a live region per row talked over itself as ' +
        'soon as more than one file moved.',
      '- Every row action is a real button with a file-specific accessible ' +
        'name, and all of them except cancel are disabled while the control ' +
        'is.',
      '- Row and status state is never colour alone: each row spells its ' +
        'status out in words, and a `forced-colors` block restates the ' +
        'borders a forced palette flattens.',
      '- Rows animate in only after the first paint, so a pre-filled `value` ' +
        'does not animate itself into view on load.',
    ].join('\n'),
    `
<h2 id="attachments-heading">Booking attachments</h2>
<lib-file-upload
  ariaLabelledby="attachments-heading"
  ariaDescribedby="attachments-hint"
  uploadUrl="/api/files"
  [multiple]="true" />
<p id="attachments-hint">Documents are kept for 30 days.</p>
`,
  ),
};
