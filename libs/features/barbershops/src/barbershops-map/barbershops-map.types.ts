import type { ComponentRef } from '@angular/core';
import type { Marker } from 'maplibre-gl';

import type { BarbershopMarker } from '../barbershop-marker/barbershop-marker';
import type { CompanyCardResponse } from '../data/barbershops.api.types';

/** Where the map is in its bootstrap. `error` is terminal; nothing retries a style load. */
export type MapStatus = 'loading' | 'ready' | 'error';

/**
 * One pin: MapLibre's marker and the Angular component whose element it moved.
 *
 * Both are held, because both have to be torn down — removing the marker leaves the component
 * attached to the view tree, and destroying the component leaves MapLibre holding a dead node.
 */
export interface ShopMarker {
  readonly marker: Marker;
  readonly ref: ComponentRef<BarbershopMarker>;
}

/**
 * What the map needs of a shop: where it is and what its pin reads. The list hands over whole
 * cards and the home page hands over its one shop, and both satisfy this.
 */
export type MapShop = Pick<CompanyCardResponse, 'id' | 'name' | 'latitude' | 'longitude'>;
