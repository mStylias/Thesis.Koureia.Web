import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActiveLanguage } from '@util/language';

import type { CompanyRatingViewDto } from '../../data/barbershops.api.types';
import { formatRating, pluralBranch } from '../format/format-rating';

/**
 * A shop's rating in one line: `★ 4,7 (128 κριτικές)`, or `Νέο` until the API reports an
 * average. The API owns the threshold, so this never counts reviews itself.
 */
@Component({
  selector: 'lib-barbershop-rating',
  imports: [TranslocoPipe],
  templateUrl: './barbershop-rating.html',
  styleUrl: './barbershop-rating.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopRating {
  private readonly language = inject(ActiveLanguage).value;

  readonly rating = input.required<CompanyRatingViewDto>();

  protected readonly average = computed(() => {
    const average = this.rating().average;
    return average === null ? null : formatRating(average, this.language());
  });

  /** The dictionary key for the review count, in the right plural. */
  protected readonly reviewsKey = computed(
    () => `barbershops.home.reviews.${pluralBranch(this.rating().count, this.language())}`,
  );
}
