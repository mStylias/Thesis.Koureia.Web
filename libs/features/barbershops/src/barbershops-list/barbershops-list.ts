import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';

import { BarbershopCard } from '../barbershop-card/barbershop-card';
import { BarbershopCardSkeleton } from '../barbershop-card-skeleton/barbershop-card-skeleton';
import { CARD_STAGGER_LIMIT, CARD_STAGGER_STEP_MS } from '../card-choreography';
import type { CompanyCardResponse } from '../data/barbershops.api.types';

/** How many skeletons stand in for a loading page. Roughly one screen of cards. */
const SKELETON_COUNT = 6;

/**
 * The result list and the three states that replace it.
 *
 * It renders one page, not the whole set — the page slices before it reaches here, so the map
 * can still be handed every loaded shop.
 */
@Component({
  selector: 'lib-barbershops-list',
  imports: [Banner, BarbershopCard, BarbershopCardSkeleton, Button, TranslocoPipe],
  templateUrl: './barbershops-list.html',
  styleUrl: './barbershops-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopsList {
  /** The current page of results. */
  readonly shops = input.required<readonly CompanyCardResponse[]>();

  /** Nothing to show yet. Skeletons stand in for the first answer only. */
  readonly loading = input(false);

  /** A newer answer is on its way, and the cards on screen are the previous one. */
  readonly refreshing = input(false);

  readonly failed = input(false);

  /** Whether a filter narrowed the list. It decides which of the two empty messages is true. */
  readonly filtered = input(false);

  readonly retry = output();

  readonly clearFilters = output();

  /** A card asked to be pointed out on the map. The page owns where the map is. */
  readonly locate = output<CompanyCardResponse>();

  protected readonly skeletons = Array.from({ length: SKELETON_COUNT }, (_, index) => index);

  /** How long a card waits before its entrance, by position in the page. */
  protected enterDelay(index: number): number {
    return Math.min(index, CARD_STAGGER_LIMIT) * CARD_STAGGER_STEP_MS;
  }
}
