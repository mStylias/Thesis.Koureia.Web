import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormField } from '@angular/forms/signals';
import { LucideUsers } from '@lucide/angular';
import {
  provideTransloco,
  TranslocoService,
  TRANSLOCO_LOADER,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
import {
  claimFieldError,
  field,
  fields,
  formEditor,
  injectFieldLabelId,
  type FormFailure,
} from '@util/forms';
import { provideUiCopy } from '@util/ui-copy';
import { Field } from './field';
import { FieldControl } from './field-control';
import { FieldEditor, FieldView } from './field-slots';
import { FormErrors } from '../form-errors/form-errors';
import { FormHost } from '../form-host/form-host';

/**
 * The root dictionary, empty on purpose: a feature's own keys are not this library's to hold, and
 * a missing key renders as itself — which is also what puts a server's sentence on a field.
 */
const rootLoader: TranslocoLoader = { getTranslation: () => of({}) };

const roleFields = fields<{ name: string; description: string }>({
  name: field({
    label: 'roles.name',
    hint: 'roles.nameHint',
    required: 'roles.nameRequired',
  }),
  description: field({ label: 'roles.description', empty: 'roles.noDescription' }),
});

@Component({
  imports: [Field, FieldControl, FieldEditor, FieldView, FormErrors, FormField, FormHost],
  template: `
    <form [libForm]="editor">
      <lib-form-errors />

      <lib-field [field]="editor.form.name" data-testid="name">
        <ng-template libFieldEditor>
          <input libFieldControl data-testid="name-input" [formField]="editor.form.name" />
        </ng-template>
      </lib-field>

      <lib-field [field]="editor.form.description" data-testid="description">
        <ng-template libFieldEditor>
          <input
            libFieldControl
            data-testid="description-input"
            aria-describedby="outside"
            [formField]="editor.form.description"
          />
        </ng-template>
      </lib-field>
    </form>
  `,
})
class FieldsHost {
  readonly model = signal({ name: '', description: '' });
  readonly failure = signal<FormFailure | undefined>(undefined);

  readonly editor = formEditor({
    model: this.model,
    fields: roleFields,
    action: () => Promise.resolve(this.failure()),
  });
}

const looseFields = fields<{ name: string }>({
  name: field({ label: 'roles.name', required: true, minLength: 4 }),
});

@Component({
  imports: [Field, FieldControl, FieldEditor, FormField, FormHost],
  template: `
    <form [libForm]="editor">
      <lib-field [field]="editor.form.name" data-testid="loose">
        <ng-template libFieldEditor>
          <input libFieldControl [formField]="editor.form.name" />
        </ng-template>
      </lib-field>
    </form>
  `,
})
class NoMessagesHost {
  readonly model = signal({ name: 'ab' });
  readonly editor = formEditor({
    model: this.model,
    fields: looseFields,
    action: () => Promise.resolve(undefined),
  });
}

@Component({
  imports: [Field, FieldView],
  template: `
    <lib-field [field]="editor.form.name" mode="view" data-testid="own">
      <ng-template libFieldView let-value>chose {{ value }}</ng-template>
    </lib-field>
  `,
})
class ViewTemplateHost {
  readonly model = signal({ name: 'Manager', description: '' });
  readonly editor = formEditor({
    model: this.model,
    fields: roleFields,
    action: () => Promise.resolve(undefined),
  });
}

@Component({
  imports: [Field, FieldControl, FieldEditor, FormField],
  template: `
    <lib-field labelStyle="plain" [icon]="icon" [field]="editor.form.name" data-testid="iconed">
      <ng-template libFieldEditor>
        <input libFieldControl [formField]="editor.form.name" />
      </ng-template>
    </lib-field>
  `,
})
class IconHost {
  readonly icon = LucideUsers;
  readonly model = signal({ name: '', description: '' });
  readonly editor = formEditor({
    model: this.model,
    fields: roleFields,
    action: () => Promise.resolve(undefined),
  });
}

/** A control that shows its own error, as `lib-time-picker` does. */
@Component({ selector: 'lib-own-error-stub', template: '' })
class OwnErrorControl {
  constructor() {
    claimFieldError();
  }
}

/** A composite that shows no error, around a control that does, as `lib-datetime-picker` is. */
@Component({
  selector: 'lib-composite-stub',
  imports: [OwnErrorControl],
  template: '<lib-own-error-stub />',
})
class CompositeControl {}

@Component({
  imports: [CompositeControl, Field, FieldEditor, FormHost, OwnErrorControl],
  template: `
    <form [libForm]="editor">
      <lib-field [field]="editor.form.name" data-testid="own">
        <ng-template libFieldEditor><lib-own-error-stub /></ng-template>
      </lib-field>
      <lib-field [field]="editor.form.description" data-testid="composite">
        <ng-template libFieldEditor><lib-composite-stub /></ng-template>
      </lib-field>
    </form>
  `,
})
class ClaimHost {
  readonly model = signal({ name: '', description: '' });
  readonly editor = formEditor({
    model: this.model,
    fields: fields<{ name: string; description: string }>({
      name: field({ label: 'roles.name', required: 'roles.nameRequired' }),
      description: field({ label: 'roles.description', required: 'roles.descriptionRequired' }),
    }),
    action: () => Promise.resolve(undefined),
  });
}

/** A control whose focusable element `<label for>` cannot name, as a select's combobox. */
@Component({
  selector: 'lib-label-probe',
  template: `<div role="group" [attr.aria-labelledby]="labelId() || null"></div>`,
})
class LabelProbe {
  protected readonly labelId = injectFieldLabelId();
}

@Component({
  imports: [Field, FieldEditor, FormHost, LabelProbe],
  template: `
    <form [libForm]="editor">
      <lib-field [field]="editor.form.name" data-testid="probe-field">
        <ng-template libFieldEditor><lib-label-probe /></ng-template>
      </lib-field>
    </form>
  `,
})
class LabelProbeHost {
  readonly model = signal({ name: '' });
  readonly editor = formEditor({
    model: this.model,
    fields: looseFields,
    action: () => Promise.resolve(undefined),
  });
}

describe('lib-field', () => {
  let fixture: ComponentFixture<FieldsHost>;
  let host: FieldsHost;

  function element(testId: string): HTMLElement {
    const found = (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);
    if (!found) {
      throw new Error(`${testId} not rendered`);
    }
    return found as HTMLElement;
  }

  function maybe(selector: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Both dictionaries the fields read from. Both loads are lazy, so a render alone is too early. */
  async function loadCopy(): Promise<void> {
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('field/en'));
    await settle();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: false },
          },
        }),
        { provide: TRANSLOCO_LOADER, useValue: rootLoader },
      ],
    });
    fixture = TestBed.createComponent(FieldsHost);
    host = fixture.componentInstance;
    await settle();
    await loadCopy();
  });

  describe('the editor', () => {
    it('labels the control it was given', () => {
      const label = element('name').querySelector('label');
      const input = element('name-input');

      expect(label?.getAttribute('for')).toBe(input.id);
      expect(input.id).not.toBe('');
      expect(label?.textContent).toContain('roles.name');
    });

    it('names a control that its label cannot reach with for', async () => {
      const probe = TestBed.createComponent(LabelProbeHost);
      probe.detectChanges();
      await probe.whenStable();
      const root = probe.nativeElement as HTMLElement;
      const combobox = root.querySelector('lib-label-probe [role="group"]');
      const label = root.querySelector('[data-testid="probe-field"] label');

      expect(label?.id).not.toBe('');
      expect(combobox?.getAttribute('aria-labelledby')).toBe(label?.id);
    });

    it('puts a decorative icon before a plain label', () => {
      const iconed = TestBed.createComponent(IconHost);
      iconed.detectChanges();

      const label = (iconed.nativeElement as HTMLElement).querySelector('label');
      const icon = label?.firstElementChild;

      expect(icon?.tagName.toLowerCase()).toBe('svg');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(element('name').querySelector('.field-label-icon')).toBeNull();
    });

    it('marks a required field without a second announcement of it', () => {
      const mark = element('name').querySelector('.field-required');

      expect(mark?.getAttribute('aria-hidden')).toBe('true');
      // The marker metadata is outside the validation gate, so it is right from the first render.
      expect(element('name-input').hasAttribute('required')).toBe(true);
      expect(element('description').querySelector('.field-required')).toBeNull();
    });

    it('turns off native validation, which would bubble over the message', () => {
      expect(maybe('form')?.hasAttribute('novalidate')).toBe(true);
    });

    it('describes the control with its hint, keeping what the consumer wrote', () => {
      const hint = element('name').querySelector('.field-hint');
      const described = element('name-input').getAttribute('aria-describedby');

      expect(hint?.textContent).toContain('roles.nameHint');
      expect(described).toBe(hint?.id);
      expect(element('description-input').getAttribute('aria-describedby')).toBe('outside');
    });

    it('takes the error area out of the layout while there is nothing in it', () => {
      expect(maybe('lib-form-errors')?.hasAttribute('hidden')).toBe(true);
    });

    it('reports nothing before a commit', () => {
      expect(element('name').querySelector('.field-error')).toBeNull();
      expect(element('name-input').getAttribute('aria-invalid')).toBeNull();
    });

    it('reports the field spec message once the form is committed', async () => {
      await host.editor.commit();
      await loadCopy();

      const error = element('name').querySelector('.field-error');
      expect(error?.textContent).toContain('roles.nameRequired');
      expect(error?.getAttribute('role')).toBe('alert');
      expect(element('name-input').getAttribute('aria-describedby')).toContain(error?.id ?? '');
    });

    it('commits when the form itself is submitted', async () => {
      maybe('form')?.dispatchEvent(new Event('submit'));
      await loadCopy();

      expect(host.editor.committed()).toBe(true);
      expect(element('name').querySelector('.field-error')).not.toBeNull();
    });

    it('puts what the write refused with on the field that earned it', async () => {
      host.model.set({ name: 'Manager', description: '' });
      host.failure.set({
        errors: [{ code: 'ROLE_NAME_TAKEN', message: 'That name is taken.', path: ['name'] }],
      });
      await settle();

      await host.editor.commit();
      await loadCopy();

      expect(element('name').querySelector('.field-error')?.textContent).toContain(
        'That name is taken.',
      );
      expect(maybe('.form-errors')).toBeNull();
    });

    it('falls back to its own copy for a rule that declares no message', async () => {
      const loose = TestBed.createComponent(NoMessagesHost);
      loose.detectChanges();
      await loose.whenStable();
      await loose.componentInstance.editor.commit();
      const transloco = TestBed.inject(TranslocoService);
      await firstValueFrom(transloco.load('field/en'));
      loose.detectChanges();
      await loose.whenStable();
      loose.detectChanges();

      const error = (loose.nativeElement as HTMLElement).querySelector('.field-error');
      // The message names the limit it is about, which only the error itself knows.
      expect(error?.textContent).toContain('at least 4 characters');
    });

    it('leaves the message to a control that shows its own', async () => {
      const claims = TestBed.createComponent(ClaimHost);
      claims.detectChanges();
      await claims.whenStable();
      await claims.componentInstance.editor.commit();
      claims.detectChanges();
      await claims.whenStable();

      const root = claims.nativeElement as HTMLElement;
      expect(root.querySelector('[data-testid="own"] .field-error')).toBeNull();
      // A control inside a composite cannot claim the field around the composite.
      expect(root.querySelector('[data-testid="composite"] .field-error')?.textContent).toContain(
        'roles.descriptionRequired',
      );
    });

    it('puts a refusal that names nothing in the form error area', async () => {
      host.model.set({ name: 'Manager', description: '' });
      host.failure.set({ errors: [{ code: 'ROLE_LIMIT', message: 'No more roles.' }] });
      await settle();

      await host.editor.commit();
      await loadCopy();

      const area = maybe('.form-errors');
      expect(maybe('lib-form-errors')?.hasAttribute('hidden')).toBe(false);
      expect(area?.getAttribute('role')).toBe('alert');
      expect(area?.textContent).toContain('No more roles.');
      expect(element('name').querySelector('.field-error')).toBeNull();
    });
  });

  describe('view mode', () => {
    beforeEach(async () => {
      host.model.set({ name: 'Manager', description: '' });
      host.editor.mode.set('view');
      await loadCopy();
    });

    it('never instantiates the control', () => {
      expect(maybe('[data-testid="name-input"]')).toBeNull();
      expect(maybe('input')).toBeNull();
    });

    it('reads the value under its own caption', () => {
      expect(element('name').querySelector('.field-view-label')?.textContent).toContain(
        'roles.name',
      );
      expect(element('name').querySelector('.field-view-value')?.textContent).toContain('Manager');
    });

    it('states an absent value rather than leaving the row blank', () => {
      const value = element('description').querySelector('.field-view-value');

      expect(value?.textContent).toContain('roles.noDescription');
      expect(value?.classList.contains('field-view-empty')).toBe(true);
    });

    it('renders a view template when the field has one', async () => {
      const own = TestBed.createComponent(ViewTemplateHost);
      own.detectChanges();
      await own.whenStable();
      own.detectChanges();

      expect((own.nativeElement as HTMLElement).textContent).toContain('chose Manager');
    });
  });
});

describe('lib-field copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        { provide: TRANSLOCO_LOADER, useValue: rootLoader },
        provideUiCopy({ 'field.errors.minLength': 'customer.tooShort' }),
      ],
    });
    const fixture = TestBed.createComponent(NoMessagesHost);
    const transloco = TestBed.inject(TranslocoService);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.editor.commit();
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('field/en'));
    transloco.setTranslation({ customer: { tooShort: 'Write {{min}} or more' } }, 'en', {
      merge: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const error = (fixture.nativeElement as HTMLElement).querySelector('.field-error');
    expect(error?.textContent).toContain('Write 4 or more');
  });
});
