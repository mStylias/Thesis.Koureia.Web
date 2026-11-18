import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { applyEach, type SchemaPathTree } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { ServicesApi, type ServiceCategoryResponse } from '@api/services';
import { StaffAccessStore } from '@auth/data-access';
import { injectErrorMessageResolver } from '@synax/client';
import { injectFormErrors } from '@synax/forms';
import { Button, ButtonIcon } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { ToasterService } from '@ui/toaster';
import {
  applySpecMarkers,
  applySpecValidators,
  field,
  fields,
  formEditor,
  type FormFailure,
} from '@util/forms';

import { ServicesStore } from '../services.store';
import type {
  CategoryChange,
  CategoryFormValue,
  CategoryTranslationFormValue,
} from './category-dialog.types';

const K = 'managementServices.category';

export const CATEGORY_NAME_MAX_LENGTH = 100;

const CATEGORY_FIELDS = fields<CategoryTranslationFormValue>({
  name: field({
    label: `${K}.name`,
    required: `${K}.errors.nameRequired`,
    maxLength: [CATEGORY_NAME_MAX_LENGTH, `${K}.errors.nameTooLong`],
  }),
});

/**
 * Creates a shop category, or renames or deletes one, with a name in every language. It writes
 * through the API itself and reloads the options. The drawer reads `changed` to select the result.
 *
 * ```html
 * <lib-service-category-dialog [(visible)]="open" [category]="null" [languages]="['el', 'en']" />
 * ```
 */
@Component({
  selector: 'lib-service-category-dialog',
  imports: [
    Button,
    ButtonIcon,
    Dialog,
    DialogFooter,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    InputText,
    LucideTrash2,
    TranslocoPipe,
  ],
  templateUrl: './category-dialog.html',
  styleUrl: './category-dialog.scss',
})
export class CategoryDialog {
  private readonly api = inject(ServicesApi);
  private readonly store = inject(ServicesStore);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly formErrors = injectFormErrors();

  readonly visible = model(false);

  /** The category to edit, or `null` for a new one. */
  readonly category = input<ServiceCategoryResponse | null>(null);

  /** Language codes, in form order. */
  readonly languages = input.required<readonly string[]>();

  readonly changed = output<CategoryChange>();

  protected readonly deleting = signal(false);

  protected readonly canDelete = computed(
    () => this.category()?.isOwned === true && this.access.has('services:update'),
  );

  protected readonly title = computed(() =>
    this.category() === null ? `${K}.titleNew` : `${K}.titleEdit`,
  );

  private readonly model = signal<CategoryFormValue>({ translations: [] });

  protected readonly editor = formEditor({
    model: this.model,
    rules: (path) => {
      applyEach(path.translations, (item) => {
        applySpecValidators(item as SchemaPathTree<CategoryTranslationFormValue>, CATEGORY_FIELDS);
      });
    },
    liveRules: (path) => {
      applyEach(path.translations, (item) => {
        applySpecMarkers(item as SchemaPathTree<CategoryTranslationFormValue>, CATEGORY_FIELDS);
      });
    },
    action: () => this.write(),
  });

  constructor() {
    // Each opening starts from the category, or from empty names.
    effect(() => {
      if (!this.visible()) return;
      const category = this.category();
      const languages = this.languages();
      untracked(() => {
        this.editor.reset({
          translations: languages.map((languageCode) => ({
            languageCode,
            name:
              category?.translations.find((item) => item.languageCode === languageCode)?.name ?? '',
          })),
        });
      });
    });
  }

  protected save(): void {
    void this.editor.commit();
  }

  protected close(): void {
    this.visible.set(false);
  }

  protected async remove(): Promise<void> {
    const category = this.category();
    if (category === null || this.deleting()) return;
    const count = category.serviceCount;
    const message =
      count === 0 ? 'deleteMessage' : count === 1 ? 'deleteMessageOne' : 'deleteMessageMany';
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.deleteTitle`),
      message: this.transloco.translate(`${K}.${message}`, { name: category.name, count }),
      confirmLabel: this.transloco.translate(`${K}.delete`),
      cancelLabel: this.transloco.translate(`${K}.cancel`),
      severity: 'error',
    });
    if (answer !== 'confirmed') return;

    this.deleting.set(true);
    const result = await firstValueFrom(this.api.deleteCategory(category.id));
    this.deleting.set(false);
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.toaster.success(this.transloco.translate('managementServices.toast.categoryDeleted'));
    this.afterWrite(true);
    this.changed.emit({ kind: 'deleted', id: category.id });
    this.visible.set(false);
  }

  private async write(): Promise<FormFailure | undefined> {
    const category = this.category();
    const request = {
      translations: this.model().translations.map((item) => ({
        languageCode: item.languageCode,
        name: item.name.trim(),
      })),
    };
    const language = this.transloco.getActiveLang();
    const result = await firstValueFrom(
      category === null
        ? this.api.createCategory(request, language)
        : this.api.updateCategory(category.id, request, language),
    );
    if (!result.isSuccess) return this.formErrors(result.error);

    this.toaster.success(
      this.transloco.translate(
        `managementServices.toast.${category === null ? 'categoryCreated' : 'categoryUpdated'}`,
      ),
    );
    this.afterWrite(category !== null);
    if (result.data !== null) this.changed.emit({ kind: 'saved', category: result.data });
    this.visible.set(false);
    return undefined;
  }

  /** The options hold the names. A rename or a delete also changes rows the grid shows. */
  private afterWrite(gridChanged: boolean): void {
    void this.store.loadOptions();
    if (gridChanged) this.store.reload();
  }
}
