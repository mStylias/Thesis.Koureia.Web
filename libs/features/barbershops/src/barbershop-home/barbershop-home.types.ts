import type { CompanyDetailsResponse } from '../data/barbershops.api.types';

/**
 * What the home page has to show. `not-found` and `failed` are told apart because they answer
 * with different statuses and say different things.
 */
export type BarbershopPage =
  | { readonly status: 'found'; readonly shop: CompanyDetailsResponse }
  | { readonly status: 'not-found' }
  | { readonly status: 'failed' };
