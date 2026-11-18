import { inject, RESPONSE_INIT } from '@angular/core';
import type { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import type { Result } from '@synax/client/core';
import { ActiveLanguage, type PageMeta } from '@util/language';
import { map } from 'rxjs';

import { BarbershopsApi } from '../data/barbershops.api';
import type { CompanyDetailsResponse } from '../data/barbershops.api.types';
import type { BarbershopPage } from './barbershop-home.types';

/** The route `resolve` key that carries the {@link BarbershopPage}. */
export const BARBERSHOP_PAGE = 'page';

const NOT_FOUND = 404;
const SERVER_ERROR = 500;

/**
 * Loads the shop the slug names.
 *
 * It never fails the navigation. An unknown slug and a failed call are both pages the visitor
 * lands on, so they resolve as states and the page renders them. During a server render it also
 * sets the status a crawler must see: 404 for an unknown slug, 500 for a failure, and neither is
 * cached.
 */
export const barbershopPageResolver: ResolveFn<BarbershopPage> = (route) => {
  const api = inject(BarbershopsApi);
  const language = inject(ActiveLanguage).value();
  const response = inject(RESPONSE_INIT, { optional: true });
  const slug = route.paramMap.get('slug') ?? '';

  return api.details(slug, language).pipe(
    map((result) => {
      const page = toPage(result);
      if (response !== null) markResponse(response, page);
      return page;
    }),
  );
};

/**
 * The page's head, built from the shop. Resolved on a child route, because a child's resolvers
 * run after its parent's, and this one reads the page the parent resolved.
 */
export const barbershopPageMetaResolver: ResolveFn<PageMeta> = (route) => {
  const transloco = inject(TranslocoService);
  const page = readPage(route);

  if (page.status !== 'found') {
    return {
      title: transloco.translate(
        page.status === 'not-found' ? 'titles.barbershopNotFound' : 'titles.barbershops',
      ),
      description: null,
      image: null,
      indexable: false,
    };
  }

  const { shop } = page;
  return {
    title: shop.name,
    description:
      shop.description ??
      transloco.translate('descriptions.barbershop', {
        name: shop.name,
        area: shop.neighborhood ?? shop.city,
      }),
    image: shop.photos.at(0)?.url ?? shop.logoUrl ?? null,
    indexable: true,
  };
};

/** The {@link BarbershopPage} a route or one of its parents resolved. */
export function readPage(route: ActivatedRouteSnapshot): BarbershopPage {
  for (let current: ActivatedRouteSnapshot | null = route; current; current = current.parent) {
    const page = current.data[BARBERSHOP_PAGE] as BarbershopPage | undefined;
    if (page !== undefined) return page;
  }
  return { status: 'failed' };
}

function toPage(result: Result<CompanyDetailsResponse>): BarbershopPage {
  if (result.isSuccess) {
    return result.data === null ? { status: 'failed' } : { status: 'found', shop: result.data };
  }
  return result.error.httpCode === NOT_FOUND ? { status: 'not-found' } : { status: 'failed' };
}

function markResponse(response: ResponseInit, page: BarbershopPage): void {
  if (page.status === 'found') return;

  response.status = page.status === 'not-found' ? NOT_FOUND : SERVER_ERROR;
  // A missing or broken page must not sit in a shared cache, and must not be indexed.
  if (response.headers instanceof Headers) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex');
  }
}
