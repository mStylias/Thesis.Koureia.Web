import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideNavigation } from '@lucide/angular';
import { Button } from '@ui/button';

import { GoogleMapsMark } from './google-maps-mark/google-maps-mark';
import { directionsUrl, placeUrl } from './google-maps-url';

/**
 * Directions to a shop and the shop in Google Maps, both in a new tab. Stacked by default. A
 * consumer sets `flex-direction` on the host to put them in a row.
 *
 * Needs the `barbershops` dictionary, which `preloadBarbershopsTranslations` loads.
 */
@Component({
  selector: 'lib-shop-map-links',
  imports: [Button, GoogleMapsMark, LucideNavigation, TranslocoPipe],
  template: `
    <a
      libButton
      variant="outlined"
      severity="secondary"
      class="shop-map-links__directions"
      [href]="directions()"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg lucideNavigation aria-hidden="true"></svg>
      {{ 'barbershops.home.location.directions' | transloco }}
      <span class="sr-only">{{ 'barbershops.home.location.newTab' | transloco }}</span>
    </a>

    <a
      libButton
      variant="outlined"
      severity="secondary"
      class="shop-map-links__google-maps"
      [href]="place()"
      target="_blank"
      rel="noopener noreferrer"
    >
      <!-- Google's own colors, so it is not a Lucide icon. -->
      <lib-google-maps-mark />
      {{ 'barbershops.home.location.googleMaps' | transloco }}
      <span class="sr-only">{{ 'barbershops.home.location.newTab' | transloco }}</span>
    </a>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    a {
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopMapLinks {
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();

  protected readonly directions = computed(() => directionsUrl(this.latitude(), this.longitude()));
  protected readonly place = computed(() => placeUrl(this.latitude(), this.longitude()));
}
