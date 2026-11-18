import { Component, signal } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { field, fields, formEditor, type FormFailure } from '@util/forms';
import { Field } from './field';
import { FieldControl } from './field-control';
import { FieldEditor, FieldView } from './field-slots';
import { FormErrors } from '../form-errors/form-errors';
import { FormHost } from '../form-host/form-host';

// Plain controls, styled for the demo only: `lib-field` is control-agnostic, and a design-system
// control would drag a second library into this one for nothing. The top padding routes through
// `--field-pad-top` exactly as every real control does, or the IFTA label lands on the value.
const CONTROL_STYLE = `
  form { display: flex; flex-direction: column; gap: var(--space-4); width: 22rem; }
  input, textarea {
    font-family: var(--font-sans);
    font-size: var(--text-base);
    color: var(--text-primary);
    background: var(--surface);
    border: var(--border-width-hairline) solid var(--border-strong);
    border-radius: var(--radius-md);
    padding: var(--field-pad-top, var(--space-2)) var(--space-3) var(--space-2);
    width: 100%;
  }
  input[aria-invalid='true'], textarea[aria-invalid='true'] { border-color: var(--error); }
  .actions { display: flex; gap: var(--space-2); }
`;

const memberFields = fields<{ name: string; email: string }>({
  name: field({
    label: 'demo.name',
    hint: 'demo.nameHint',
    required: 'demo.nameRequired',
    maxLength: 40,
  }),
  email: field({ label: 'demo.email', required: true, email: 'demo.emailInvalid' }),
});

@Component({
  selector: 'lib-field-deferred-demo',
  imports: [Field, FieldControl, FieldEditor, FormErrors, FormField, FormHost],
  styles: CONTROL_STYLE,
  template: `
    <form [libForm]="editor">
      <lib-form-errors />

      <lib-field [field]="editor.form.name">
        <ng-template libFieldEditor>
          <input libFieldControl placeholder=" " [formField]="editor.form.name" />
        </ng-template>
      </lib-field>

      <lib-field [field]="editor.form.email">
        <ng-template libFieldEditor>
          <input libFieldControl type="email" placeholder=" " [formField]="editor.form.email" />
        </ng-template>
      </lib-field>

      <div class="actions">
        <button type="submit" [disabled]="editor.submitting()">Save</button>
      </div>
    </form>
  `,
})
class FieldDeferredDemo {
  readonly model = signal({ name: '', email: '' });
  readonly editor = formEditor({
    model: this.model,
    fields: memberFields,
    action: () => Promise.resolve(undefined),
  });
}

@Component({
  selector: 'lib-field-server-demo',
  imports: [Field, FieldControl, FieldEditor, FormErrors, FormField, FormHost],
  styles: CONTROL_STYLE,
  template: `
    <form [libForm]="editor">
      <lib-form-errors />

      <lib-field [field]="editor.form.name">
        <ng-template libFieldEditor>
          <input libFieldControl placeholder=" " [formField]="editor.form.name" />
        </ng-template>
      </lib-field>

      <lib-field [field]="editor.form.email">
        <ng-template libFieldEditor>
          <input libFieldControl type="email" placeholder=" " [formField]="editor.form.email" />
        </ng-template>
      </lib-field>

      <div class="actions">
        <button type="submit" [disabled]="editor.submitting()">Save</button>
      </div>
    </form>
  `,
})
class FieldServerDemo {
  readonly model = signal({ name: 'Maria', email: 'maria@example.com' });
  readonly editor = formEditor({
    model: this.model,
    fields: memberFields,
    action: () => Promise.resolve(this.refusal()),
  });

  private refusal(): FormFailure {
    return {
      errors: [
        {
          code: 'EMAIL_TAKEN',
          message: 'That email address is already a member.',
          path: ['email'],
        },
        { code: 'SEAT_LIMIT', message: 'This company has no seats left.' },
      ],
    };
  }
}

@Component({
  selector: 'lib-field-view-demo',
  imports: [Field, FieldControl, FieldEditor, FieldView, FormField, FormHost],
  styles: CONTROL_STYLE,
  template: `
    <form [libForm]="editor">
      <lib-field [field]="editor.form.name">
        <ng-template libFieldEditor>
          <input libFieldControl placeholder=" " [formField]="editor.form.name" />
        </ng-template>
      </lib-field>

      <lib-field [field]="editor.form.email">
        <ng-template libFieldEditor>
          <input libFieldControl type="email" placeholder=" " [formField]="editor.form.email" />
        </ng-template>
        <ng-template libFieldView let-value>
          <a [href]="'mailto:' + value">{{ value }}</a>
        </ng-template>
      </lib-field>

      <div class="actions">
        <button type="button" (click)="toggle()">
          {{ editor.viewing() ? 'Edit' : 'Done' }}
        </button>
      </div>
    </form>
  `,
})
class FieldViewDemo {
  readonly model = signal({ name: 'Maria', email: 'maria@example.com' });
  readonly editor = formEditor({
    model: this.model,
    fields: memberFields,
    action: () => Promise.resolve(undefined),
  });

  protected toggle(): void {
    this.editor.mode.set(this.editor.viewing() ? 'edit' : 'view');
  }
}

/**
 * Shorthand for a per-story description in the autodocs page. The source override is required:
 * every example renders through a demo component, so "Show code" would otherwise print
 * `<lib-field-*-demo />` rather than the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const meta: Meta = {
  title: 'Forms & input/Field',
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
    moduleMetadata({ imports: [FieldDeferredDemo, FieldServerDemo, FieldViewDemo] }),
  ],
};

export default meta;
type Story = StoryObj;

/**
 * A field renders whatever its spec says about it: the label, the hint, the required mark and,
 * once there is something to say, the message. Nothing is reported before Save is pressed —
 * leaving a field empty is not a mistake until the user says the form is finished — and from then
 * on validation is live.
 */
export const DeferredValidation: Story = {
  render: () => ({ template: '<lib-field-deferred-demo />' }),
  parameters: doc(
    'Press **Save** on the empty form: both fields report at once, and each message clears as ' +
      'it is answered. The demo dictionary is empty, so the labels and messages render as their ' +
      'own keys — that is also what puts a server sentence on a field, since a key the ' +
      'dictionary does not hold renders as itself.\n\n' +
      'The Save button is never disabled by validity. The first press is what reveals it, so a ' +
      'button disabled until the form is valid would be one the user could never make live.',
    `
<form [libForm]="editor">
  <lib-form-errors />

  <lib-field [field]="editor.form.name">
    <ng-template libFieldEditor>
      <input libInputText libFieldControl placeholder=" " [formField]="editor.form.name" />
    </ng-template>
  </lib-field>

  <button type="submit" [disabled]="editor.submitting()">Save</button>
</form>
    `,
  ),
};

/**
 * What a refused write said, put back where it came from: a failure naming a property lands on
 * that field, and everything else stays in the form's own error area above.
 */
export const ServerErrors: Story = {
  render: () => ({ template: '<lib-field-server-demo />' }),
  parameters: doc(
    'The demo write always refuses, with one failure about the email address and one about the ' +
      'company. Editing the email clears its message; the company one is kept until the next ' +
      'press, because a failure about the whole submission is not answered by editing one field.',
    `
protected readonly editor = formEditor({
  model: this.model,
  fields: memberFields,
  action: async () => {
    const result = await firstValueFrom(this.api.addMember(this.model()));
    return result.isSuccess ? undefined : this.formErrors(result.error, { EMAIL_TAKEN: 'email' });
  },
});
    `,
    'ts',
  ),
};

/**
 * The same fields, read rather than edited. The control is never instantiated in view mode, so
 * nothing reads as a control the user is being refused.
 */
export const ViewMode: Story = {
  render: () => ({ template: '<lib-field-view-demo />' }),
  parameters: doc(
    'Press **Done** to read the record and **Edit** to change it. A field with no view template ' +
      "renders its value as text through the spec's `view` formatting, and an empty one says so " +
      'rather than leaving the row blank. Give a field a `libFieldView` template when the value ' +
      'reads as something else entirely — a link, a chip, a count.',
    `
<lib-field [field]="editor.form.email">
  <ng-template libFieldEditor>
    <input libInputText libFieldControl placeholder=" " [formField]="editor.form.email" />
  </ng-template>
  <ng-template libFieldView let-value>
    <a [href]="'mailto:' + value">{{ value }}</a>
  </ng-template>
</lib-field>
    `,
  ),
};
