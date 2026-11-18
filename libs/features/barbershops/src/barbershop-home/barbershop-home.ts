import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import {
  LucideCalendar,
  LucideMap,
  LucideMapPin,
  LucideScissors,
  LucideSearchX,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { Gallery, type GalleryImage } from '@ui/gallery';
import { LangLink } from '@util/language';
import { map } from 'rxjs';

import { barbershopsTranslocoScope } from '../barbershops.i18n';
import { BarbershopBarbers } from './barbershop-barbers/barbershop-barbers';
import { readPage } from './barbershop-home.resolvers';
import { BarbershopLocation } from './barbershop-location/barbershop-location';
import { BarbershopRating } from './barbershop-rating/barbershop-rating';
import { BarbershopServices } from './barbershop-services/barbershop-services';

/**
 * One barbershop's home page: its photos, where it is and how it is rated, what it offers and
 * for how much, who cuts, and a map.
 *
 * The shop arrives through the route's resolver, so the server render carries it and the page
 * title and share preview are written before the HTML leaves the server.
 */
@Component({
  selector: 'lib-barbershop-home',
  imports: [
    BarbershopBarbers,
    BarbershopLocation,
    BarbershopRating,
    BarbershopServices,
    Button,
    Gallery,
    LangLink,
    LucideCalendar,
    LucideMap,
    LucideMapPin,
    LucideScissors,
    LucideSearchX,
    TranslocoPipe,
  ],
  templateUrl: './barbershop-home.html',
  styleUrl: './barbershop-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideTranslocoScope(barbershopsTranslocoScope)],
})
export class BarbershopHome {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);

  private readonly location = viewChild<ElementRef<HTMLElement>>('location');

  protected readonly page = toSignal(
    this.route.data.pipe(map(() => readPage(this.route.snapshot))),
    { requireSync: true },
  );

  protected readonly shop = computed(() => {
    const page = this.page();
    return page.status === 'found' ? page.shop : null;
  });

  /** The gallery. The API sends the main photo first. The logo is not a photo. */
  protected readonly images = computed<readonly GalleryImage[]>(() => {
    const shop = this.shop();
    if (shop === null) return [];

    return shop.photos.map((photo) => ({
      src: photo.url,
      alt: photo.altText,
      width: photo.width,
      height: photo.height,
    }));
  });

  /** Where the shop is, in the words a local uses. */
  protected readonly area = computed(() => {
    const shop = this.shop();
    return shop === null ? '' : (shop.neighborhood ?? shop.city);
  });

  protected readonly hasServices = computed(() => {
    const shop = this.shop();
    return (
      shop !== null && (shop.serviceCategories.length > 0 || shop.uncategorizedServices.length > 0)
    );
  });

  protected readonly bookingLink = computed(() => [
    '/barbershops',
    this.shop()?.slug ?? '',
    'booking',
  ]);

  /** Only a click reaches this, so there is no server render to guard. */
  protected scrollToMap(): void {
    const reduce = this.document.defaultView?.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.location()?.nativeElement.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  /** Runs the resolver again for the same address. */
  protected retry(): void {
    void this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
  }
}
