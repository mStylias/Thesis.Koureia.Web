import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe, provideTranslocoScope, translateSignal } from '@jsverse/transloco';
import { ActiveLanguage } from '@util/language';

import { barbershopsTranslocoScope } from '../../barbershops.i18n';
import { ReplayOnChange } from '../../replay-on-change';
import type { CompanyBookingOptionsResponse } from '../../data/booking.api.types';
import { BOOKING_STEPS } from '../booking-state';
import type {
  BookingStepId,
  BookingSummaryLayout,
  BookingSummaryRow,
  BookingSummaryValue,
  BookingTotals,
  ChosenService,
} from '../booking.types';
import { formatDuration, formatPrice, formatShopDate, formatTotals } from '../core/format-booking';

/**
 * Everything the customer has chosen, as rows.
 *
 * Written once and rendered in three places: the wide-screen panel, both slots of the narrow
 * bottom sheet, and the confirm step on a phone. Two components that had to agree about what a
 * booking looks like would stop agreeing.
 *
 * A row is **filled or waiting, never absent**. A waiting row keeps its label and shows a dash,
 * so the panel's height does not jump as the flow advances and the customer can see what is
 * still to come.
 *
 * **Nothing here is a control.** It states what was chosen; the stepper and the back button
 * are what change it.
 *
 * Stacked, a row is a heading over its choices, each choice a line with the name at
 * the start and its duration and price at the end. Inline, the same rows become chips.
 */
@Component({
  selector: 'lib-booking-summary',
  imports: [ReplayOnChange, TranslocoPipe],
  // Its own scope, not the one it inherits. `translateSignal` reads the nearest
  // `TRANSLOCO_SCOPE`, and inside `lib-bottom-sheet` that is the sheet's.
  providers: [provideTranslocoScope(barbershopsTranslocoScope)],
  templateUrl: './booking-summary.html',
  styleUrl: './booking-summary.scss',
  host: {
    '[attr.data-layout]': 'layout()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingSummary {
  private readonly language = inject(ActiveLanguage);

  readonly shop = input.required<CompanyBookingOptionsResponse | null>();
  readonly chosen = input.required<readonly ChosenService[]>();
  readonly totals = input.required<BookingTotals>();
  readonly barberName = input<string | null>(null);
  readonly date = input<string | null>(null);
  readonly time = input<string | null>(null);
  /** The step showing now. Decides which rows have been reached and so hold a value. */
  readonly step = input.required<BookingStepId>();
  /**
   * Whether the shop's logo and name head the rows. Withheld where the surface around it
   * already names the shop, as the bottom sheet's collapsed bar does.
   */
  readonly showShop = input(true);
  /**
   * Whether the total closes the rows. Withheld where the surface around it shows the total
   * itself, as the bottom sheet's actions row does.
   */
  readonly showTotal = input(true);
  /**
   * `stacked` is a column of rows. `inline` runs them across one line for the wide-screen
   * footer bar. It is a presentation only — the rows and their contents are the same.
   */
  readonly layout = input<BookingSummaryLayout>('stacked');

  /**
   * Whether the first paint is behind us.
   *
   * `animate.enter` fires on that paint too, so a resumed draft would arrive with every chip
   * it already holds popping at once. A choice animates only once the customer makes one.
   */
  private readonly rendered = signal(false);

  protected readonly valueEnter = computed(() => (this.rendered() ? 'summary-value-enter' : ''));

  constructor() {
    afterNextRender(() => {
      this.rendered.set(true);
    });
  }

  private readonly servicesLabel = translateSignal('booking.summary.services');
  private readonly barberLabel = translateSignal('booking.summary.barber');
  private readonly whenLabel = translateSignal('booking.summary.when');
  private readonly anyoneLabel = translateSignal('booking.barber.anyone');
  private readonly totalLabel = translateSignal('booking.summary.total');

  /** `2 υπηρεσίες · 75'` — what the price is made of, for the bar that shows the price large. */
  private readonly countParams = computed(() => ({
    count: String(this.chosen().length),
    duration: formatDuration(this.totals().durationMinutes),
  }));

  private readonly countOneLabel = translateSignal('booking.summary.countOne', this.countParams);
  private readonly countManyLabel = translateSignal('booking.summary.countMany', this.countParams);

  protected readonly initials = computed(() =>
    (this.shop()?.name ?? '')
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase(),
  );

  private readonly totalsLabel = computed(() => {
    const options = this.shop();
    if (options === null) return '';
    return formatTotals(this.totals(), options.currency, this.language.value());
  });

  /**
   * What heads the total.
   *
   * Stacked it is the word `Σύνολο`, because the amount beside it carries the duration too.
   * Inline the duration moves up here with the service count, which leaves the amount alone
   * to be the largest thing in the bar.
   */
  protected readonly totalHeading = computed(() => {
    if (this.layout() !== 'inline') return this.totalLabel();
    return this.chosen().length === 1 ? this.countOneLabel() : this.countManyLabel();
  });

  /** The amount. Duration included only where the heading does not already carry it. */
  protected readonly totalAmount = computed(() => {
    const options = this.shop();
    if (options === null) return '';
    if (this.layout() !== 'inline') return this.totalsLabel();
    return formatPrice(this.totals().price, options.currency, this.language.value());
  });

  protected readonly rows = computed<readonly BookingSummaryRow[]>(() => {
    const options = this.shop();
    if (options === null) return [];

    const locale = this.language.value();
    const currentIndex = BOOKING_STEPS.indexOf(this.step());
    const reached = (step: BookingStepId): boolean => BOOKING_STEPS.indexOf(step) <= currentIndex;

    const services = this.chosen();
    const date = this.date();
    const time = this.time();

    const when: BookingSummaryValue[] = [];
    if (date !== null) {
      when.push({ text: formatShopDate(date, locale), meta: time ?? undefined });
    }

    return [
      {
        id: 'services',
        label: this.servicesLabel(),
        values: services.map((service) => ({
          text: service.name,
          meta: `${formatDuration(service.durationMinutes)} • ${formatPrice(service.price, options.currency, locale)}`,
        })),
      },
      {
        id: 'barber',
        label: this.barberLabel(),
        // Filled from the moment the step opens, not once it is behind. Anyone is the standing
        // choice and the step shows it already chosen, so a summary that stayed empty until
        // the customer moved on would be the only thing on screen disagreeing with it.
        values: reached('barber') ? [{ text: this.barberName() ?? this.anyoneLabel() }] : [],
      },
      {
        id: 'when',
        label: this.whenLabel(),
        values: when,
      },
    ];
  });
}
