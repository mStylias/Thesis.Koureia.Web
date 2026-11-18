import { Component, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { CompanyApi, type CompanyPhotoResponse } from '@api/company';
import { injectFormErrors } from '@synax/forms';
import { Button } from '@ui/button';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { Textarea } from '@ui/textarea';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { ALT_TEXT_FIELDS, altTextForm, altTextPath, altTextRequest } from '../form/alt-text.form';
import type { AltTextFormValue } from '../form/alt-text.form.types';

/**
 * A photo's description for screen readers, in Greek and English. An empty one reads as the
 * shop's name on the public page.
 *
 * ```html
 * <lib-photo-details-dialog [(visible)]="open" [photo]="photo()" (saved)="replace($event)" />
 * ```
 */
@Component({
  selector: 'lib-photo-details-dialog',
  imports: [
    Button,
    Dialog,
    DialogFooter,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    Textarea,
    TranslocoPipe,
  ],
  template: `
    @let fields = editor.form;
    <lib-dialog
      size="sm"
      [(visible)]="visible"
      [header]="'managementCompany.photos.alt.title' | transloco"
    >
      <form class="alt-form" [libForm]="editor">
        <lib-form-errors />
        <p class="alt-hint" id="photo-alt-hint">
          {{ 'managementCompany.photos.alt.hint' | transloco }}
        </p>
        <lib-field [field]="fields.el">
          <ng-template libFieldEditor>
            <textarea
              libTextarea
              libFieldControl
              rows="2"
              lang="el"
              aria-describedby="photo-alt-hint"
              placeholder=" "
              [formField]="fields.el"
            ></textarea>
          </ng-template>
        </lib-field>
        <lib-field [field]="fields.en">
          <ng-template libFieldEditor>
            <textarea
              libTextarea
              libFieldControl
              rows="2"
              lang="en"
              aria-describedby="photo-alt-hint"
              placeholder=" "
              [formField]="fields.en"
            ></textarea>
          </ng-template>
        </lib-field>
      </form>

      <ng-template libDialogFooter>
        <button
          libButton
          type="button"
          severity="secondary"
          variant="text"
          [disabled]="editor.submitting()"
          (click)="visible.set(false)"
        >
          {{ 'managementCompany.actions.cancel' | transloco }}
        </button>
        <!-- Never disabled by validity: the first press is what reveals it. -->
        <button
          libButton
          type="button"
          severity="primary"
          [loading]="editor.submitting()"
          (click)="save()"
        >
          {{ 'managementCompany.actions.save' | transloco }}
        </button>
      </ng-template>
    </lib-dialog>
  `,
  styleUrl: './photo-details-dialog.scss',
})
export class PhotoDetailsDialog {
  private readonly api = inject(CompanyApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly formErrors = injectFormErrors();

  readonly visible = model(false);
  readonly photo = input<CompanyPhotoResponse | null>(null);

  /** The photo with its new description. */
  readonly saved = output<CompanyPhotoResponse>();

  private readonly model = signal<AltTextFormValue>({ el: '', en: '' });

  protected readonly editor = formEditor({
    model: this.model,
    fields: ALT_TEXT_FIELDS,
    action: () => this.write(),
  });

  constructor() {
    // Each opening starts from the photo's description.
    effect(() => {
      const photo = this.photo();
      if (!this.visible() || photo === null) return;
      untracked(() => {
        this.editor.reset(altTextForm(photo));
      });
    });
  }

  protected save(): void {
    void this.editor.commit();
  }

  private async write(): Promise<FormFailure | undefined> {
    const photo = this.photo();
    if (photo === null) return undefined;
    const result = await firstValueFrom(
      this.api.updatePhoto(photo.id, altTextRequest(this.model())),
    );
    if (!result.isSuccess) {
      const failure = this.formErrors(result.error);
      return {
        errors: failure.errors.map((error) => ({ ...error, path: altTextPath(error.path) })),
      };
    }
    this.toaster.success(this.transloco.translate('managementCompany.photos.alt.saved'));
    this.saved.emit(result.data ?? photo);
    this.visible.set(false);
    return undefined;
  }
}
