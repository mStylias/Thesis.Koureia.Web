import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideLocateFixed, LucideScissors } from '@lucide/angular';
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardMedia,
  CardSubtitle,
  CardTitle,
} from '@ui/card';
import { Button } from '@ui/button';
import { Tooltip } from '@ui/tooltip';
import { ActiveLanguage, LangLink } from '@util/language';

import type { CompanyCardResponse } from '../data/barbershops.api.types';
import { formatDistance } from './format-distance';

/**
 * One barbershop in the result list.
 *
 * The card is not clickable as a whole, on purpose: `@ui/card` adds no role and no activation,
 * and a `role="button"` surface would swallow the anchors inside it. The title and the photo open
 * the shop's home page and the button opens its booking page.
 */
@Component({
  selector: 'lib-barbershop-card',
  imports: [
    Button,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    CardMedia,
    CardSubtitle,
    CardTitle,
    LangLink,
    LucideLocateFixed,
    LucideScissors,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './barbershop-card.html',
  styleUrl: './barbershop-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopCard {
  private readonly language = inject(ActiveLanguage).value;

  readonly shop = input.required<CompanyCardResponse>();

  /**
   * Whether the card offers to point the shop out on the map.
   *
   * Off for the card the map draws inside its own popup: the map is already looking at that
   * shop, so the control would be a button that does nothing.
   */
  readonly showLocate = input(true);

  /** The reader asked to see this shop on the map. */
  readonly locate = output();

  /**
   * The address, one line. The region is left out: every result is in one city today, so it
   * repeats on every card and pushes the street out of the line.
   */
  protected readonly address = computed(() => {
    const shop = this.shop();
    return `${shop.street} • ${shop.city}`;
  });

  protected readonly distance = computed(() =>
    formatDistance(this.shop().distanceMeters, this.language()),
  );

  /** The shop's home page. */
  protected readonly link = computed(() => ['/barbershops', this.shop().slug]);

  /** The shop's booking page. */
  protected readonly bookingLink = computed(() => ['/barbershops', this.shop().slug, 'booking']);
}
