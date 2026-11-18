import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { BarbershopsMap } from '../barbershops-map/barbershops-map';
import type { MapShop } from '../barbershops-map/barbershops-map.types';
import { BarbershopsMapSkeleton } from '../barbershops-map-skeleton/barbershops-map-skeleton';

/**
 * One shop on a map, at street level. The consumer sizes and frames the host.
 *
 * Needs the `barbershops` dictionary, which `preloadBarbershopsTranslations` loads.
 */
@Component({
  selector: 'lib-shop-map',
  imports: [BarbershopsMap, BarbershopsMapSkeleton, TranslocoPipe],
  template: `
    <div
      class="shop-map"
      role="region"
      [attr.aria-label]="'barbershops.home.location.map' | transloco: { name: shop().name }"
    >
      <!-- MapLibre boots only when the map scrolls into view. The server renders the skeleton. -->
      @defer (on viewport) {
        <lib-barbershops-map [shops]="pins()" [focus]="shop()" />
      } @placeholder {
        <lib-barbershops-map-skeleton />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .shop-map,
    lib-barbershops-map,
    lib-barbershops-map-skeleton {
      display: block;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopMap {
  readonly shop = input.required<MapShop>();

  protected readonly pins = computed(() => [this.shop()]);
}
