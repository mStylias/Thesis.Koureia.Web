import { Component, inject, Injector, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CustomerReviewsApi, type ReviewResponse } from '@api/customer-reviews';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { Card } from '@ui/card';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Rating } from '@ui/rating';
import { ToasterService } from '@ui/toaster';
import { formatShopDate } from '@util/booking-format';
import { ActiveLanguage } from '@util/language';
import { firstValueFrom } from 'rxjs';

import type { ReviewTarget } from '../account.types';
import { ACCOUNT_PAGE_SIZE, PagedListLoader } from '../paged-list';
import { ReviewDialog } from './review-dialog/review-dialog';
import { reviewTarget } from './review-target';

/** The customer's reviews, newest first, each editable and deletable. */
@Component({
  selector: 'lib-account-reviews',
  imports: [Banner, Button, Card, Rating, ReviewDialog, TranslocoPipe],
  templateUrl: './account-reviews.html',
  styleUrl: './account-reviews.scss',
})
export class AccountReviews {
  private readonly api = inject(CustomerReviewsApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly language = inject(ActiveLanguage);

  protected readonly reviews = new PagedListLoader<ReviewResponse>((page) =>
    this.api.list({ page, pageSize: ACCOUNT_PAGE_SIZE, languageCode: this.language.value() }),
  );

  protected readonly dialogOpen = signal(false);
  protected readonly target = signal<ReviewTarget | null>(null);

  constructor() {
    void this.reviews.reload();
  }

  protected visitDate(review: ReviewResponse): string {
    return formatShopDate(review.visitDate, this.language.value(), true);
  }

  protected edit(review: ReviewResponse): void {
    this.target.set(reviewTarget(review));
    this.dialogOpen.set(true);
  }

  protected saved(review: ReviewResponse): void {
    this.reviews.replace((item) => item.id === review.id, review);
  }

  protected async remove(review: ReviewResponse): Promise<void> {
    const params = { shop: review.companyName };
    const answer = await this.confirmation.open(
      {
        title: this.transloco.translate('account.reviews.deleteTitle'),
        message: this.transloco.translate('account.reviews.deleteMessage', params),
        severity: 'error',
        confirmLabel: this.transloco.translate('account.reviews.deleteConfirm'),
        cancelLabel: this.transloco.translate('account.reviews.deleteKeep'),
      },
      this.injector,
    );
    if (answer !== 'confirmed') return;

    const result = await firstValueFrom(this.api.delete(review.id));
    if (!result.isSuccess) {
      this.toaster.error(this.transloco.translate('account.errors.generic'));
      return;
    }
    this.reviews.remove((item) => item.id === review.id);
    this.toaster.success(this.transloco.translate('account.reviews.deleted'));
  }
}
