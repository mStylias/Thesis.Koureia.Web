import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideMapPin } from '@lucide/angular';

import type { MapShop } from '../../barbershops-map/barbershops-map.types';
import type { CompanyDetailsResponse } from '../../data/barbershops.api.types';
import { ShopMap } from '../../shop-map/shop-map';
import { ShopMapLinks } from '../../shop-map-links/shop-map-links';

/**
 * Where the shop is: its map, its address, and links to it in Google Maps. Projected content
 * goes last in the address card.
 */
@Component({
  selector: 'lib-barbershop-location',
  imports: [LucideMapPin, ShopMap, ShopMapLinks, TranslocoPipe],
  templateUrl: './barbershop-location.html',
  styleUrl: './barbershop-location.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopLocation {
  readonly shop = input.required<CompanyDetailsResponse>();

  protected readonly pin = computed<MapShop>(() => {
    const { id, name, latitude, longitude } = this.shop();
    return { id, name, latitude, longitude };
  });
}
