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
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CustomerReviewErrorCodes,
  CustomerReviewsApi,
  type ReviewResponse,
} from '@api/customer-reviews';
import { injectFormErrors } from '@synax/forms';
import type { HttpError } from '@synax/client/core';
import { Button } from '@ui/button';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { Rating } from '@ui/rating';
import { Textarea } from '@ui/textarea';
import { ToasterService } from '@ui/toaster';
import { formatShopDate } from '@util/booking-format';
import { formEditor, type FormFailure } from '@util/forms';
import { ActiveLanguage } from '@util/language';
import { firstValueFrom } from 'rxjs';

import type { ReviewFormValue, ReviewTarget } from '../../account.types';
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_FIELDS,
  createReviewRequest,
  reviewForm,
  updateReviewRequest,
} from './review.form';

/** Refusals that mean the page is out of date, so the caller reloads it. */
const STALE_CODES: readonly string[] = [
  CustomerReviewErrorCodes.AlreadyExists,
  CustomerReviewErrorCodes.NotReviewable,
  CustomerReviewErrorCodes.WindowClosed,
  CustomerReviewErrorCodes.NotFound,
];

/**
 * Writes a review: stars and an optional comment, for a new review of a visit or a change to
 * one. The list, the appointment page and the reviews tab all open this one.
 *
 * ```html
 * <lib-review-dialog [(visible)]="open" [target]="target()" (saved)="update($event)" />
 * ```
 */
@Component({
  selector: 'lib-review-dialog',
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
    Rating,
    Textarea,
    TranslocoPipe,
  ],
  templateUrl: './review-dialog.html',
  styleUrl: './review-dialog.scss',
})
export class ReviewDialog {
  private readonly api = inject(CustomerReviewsApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly language = inject(ActiveLanguage);
  private readonly formErrors = injectFormErrors();

  readonly visible = model(false);
  readonly target = input<ReviewTarget | null>(null);

  /** The review as the server saved it. */
  readonly saved = output<ReviewResponse>();
  /** The visit changed under the page: it was reviewed elsewhere, or its window closed. */
  readonly stale = output();

  protected readonly commentMax = REVIEW_COMMENT_MAX_LENGTH;

  private readonly model = signal<ReviewFormValue>(reviewForm(null));

  protected readonly editor = formEditor({
    model: this.model,
    fields: REVIEW_FIELDS,
    action: () => this.write(),
  });

  protected readonly title = computed(() =>
    this.target()?.kind === 'edit' ? 'account.review.editTitle' : 'account.review.createTitle',
  );

  protected readonly submitLabel = computed(() =>
    this.target()?.kind === 'edit' ? 'account.review.save' : 'account.review.post',
  );

  protected readonly context = computed(() => {
    const visit = this.target()?.visit;
    if (visit === undefined) return null;
    return {
      shop: visit.shop,
      date: formatShopDate(visit.date, this.language.value(), true),
      barber: visit.barber,
    };
  });

  protected readonly commentLength = computed(() => this.editor.form.comment().value().length);

  constructor() {
    // Each opening starts from the target: empty for a new review, the saved one for an edit.
    effect(() => {
      if (!this.visible()) return;
      const target = this.target();
      untracked(() => {
        this.editor.reset(reviewForm(target));
      });
    });
  }

  protected submit(): void {
    void this.editor.commit();
  }

  protected close(): void {
    this.visible.set(false);
  }

  private async write(): Promise<FormFailure | undefined> {
    const target = this.target();
    if (target === null) return undefined;

    const language = this.language.value();
    const value = this.model();

    if (target.kind === 'edit') {
      const patch = updateReviewRequest(value, target);
      if (Object.keys(patch).length === 0) {
        this.visible.set(false);
        return undefined;
      }
      const result = await firstValueFrom(this.api.update(target.reviewId, patch, language));
      if (!result.isSuccess) return this.refused(result.error);
      this.done(result.data, 'account.review.updated');
      return undefined;
    }

    const result = await firstValueFrom(
      this.api.create(target.appointmentId, createReviewRequest(value), language),
    );
    if (!result.isSuccess) return this.refused(result.error);
    this.done(result.data, 'account.review.created');
    return undefined;
  }

  private done(review: ReviewResponse | null, message: string): void {
    this.toaster.success(this.transloco.translate(message));
    if (review !== null) this.saved.emit(review);
    this.visible.set(false);
  }

  private refused(error: HttpError): FormFailure | undefined {
    if (STALE_CODES.includes(error.errorCode)) {
      this.toaster.error(this.transloco.translate(`account.errors.${error.errorCode}`));
      this.visible.set(false);
      this.stale.emit();
      return undefined;
    }
    return this.formErrors(error, {
      [CustomerReviewErrorCodes.InvalidRating]: 'rating',
      [CustomerReviewErrorCodes.InvalidComment]: 'comment',
    });
  }
}
