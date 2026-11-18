import type { AppointmentsApi, CustomerOptionODataResponse } from '@api/appointments';
import { odataSource } from '@data/odata-source';
import { foldText, type DataSource } from '@ui/data-source';

const PHONE = /^[+\d\s().-]+$/;

/**
 * The shop's customers: everyone who booked here, walk-ins included, paged and searchable by
 * name, phone and email.
 */
export function customersSource(api: AppointmentsApi): DataSource<CustomerOptionODataResponse> {
  return odataSource<CustomerOptionODataResponse>({
    fetch: (query) => {
      const search = query.search === undefined ? '' : customerSearchTerm(query.search);
      return api.customers({
        ...query,
        search: search === '' ? undefined : search,
        orderBy: query.orderBy ?? 'displayName',
      });
    },
    key: { selector: 'id', type: 'uuid' },
    capabilities: { search: true },
  });
}

/**
 * A `$search` term the customers endpoint parses, or `''` when there is nothing to search.
 *
 * - The term must be one quoted phrase. The endpoint's parser refuses an unquoted word that holds
 *   a digit or an `@`, so `6977` and `maria@` are a 400 unquoted.
 * - A phone goes as bare digits. The API stores E.164, and "contains" then matches with or without
 *   the country code.
 * - Anything else is folded here as well as on the server. Postgres lowercases a capital `Σ` to
 *   `σ` and never to the final `ς`, so `ΓΙΩΡΓΟΣ` misses `Γιώργος` unless the client folds it.
 */
export function customerSearchTerm(raw: string): string {
  const trimmed = raw.trim();
  const term =
    PHONE.test(trimmed) && /\d/.test(trimmed) ? trimmed.replace(/\D/g, '') : foldText(trimmed);
  if (term === '') return '';
  return `"${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
