import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideCheck } from '@lucide/angular';
import { ActiveLanguage } from '@util/language';

import { BookingState } from '../../booking-state';
import { formatDuration, formatPrice } from '../../core/format-booking';

/**
 * Step 2: which services.
 *
 * Multi-select. Each toggle is its own committed choice, so a back press removes one service
 * rather than emptying the basket.
 *
 * The running total is deliberately **not** here: the summary surface carries it at every screen
 * size, and the same number twice on one screen is a pair that can disagree.
 */
@Component({
  selector: 'lib-booking-services',
  imports: [LucideCheck, TranslocoPipe],
  templateUrl: './booking-services.html',
  styleUrl: './booking-services.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingServices {
  private readonly language = inject(ActiveLanguage);

  protected readonly state = inject(BookingState);

  protected readonly currency = computed(() => this.state.options()?.currency ?? 'EUR');

  protected readonly chosenIds = computed(() => new Set(this.state.serviceIds()));

  protected price(amount: number): string {
    return formatPrice(amount, this.currency(), this.language.value());
  }

  protected duration(minutes: number): string {
    return formatDuration(minutes);
  }
}
