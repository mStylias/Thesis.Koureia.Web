import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The shape of a {@link BarbershopCard} while the list loads.
 *
 * Purely decorative — the list that holds these owns the status announcement, so nothing here
 * is exposed to assistive technology.
 */
@Component({
  selector: 'lib-barbershop-card-skeleton',
  template: `
    <div class="card-skeleton__header">
      <span class="card-skeleton__logo"></span>
      <span class="card-skeleton__names">
        <span class="card-skeleton__line card-skeleton__line--title"></span>
        <span class="card-skeleton__line card-skeleton__line--subtitle"></span>
      </span>
    </div>

    <span class="card-skeleton__line"></span>
    <span class="card-skeleton__line card-skeleton__line--short"></span>

    <div class="card-skeleton__footer">
      <span class="card-skeleton__line card-skeleton__line--distance"></span>
      <span class="card-skeleton__line card-skeleton__line--action"></span>
    </div>
  `,
  styleUrl: './barbershop-card-skeleton.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class BarbershopCardSkeleton {}
