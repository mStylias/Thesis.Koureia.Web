import { Service, computed, inject, signal } from '@angular/core';
import { CustomersApi, type CustomerODataResponse } from '@api/customers';
import { StaffAccessStore, type WorkspaceStaffMemberViewDto } from '@auth/data-access';
import { odataSource } from '@data/odata-source';
import { customerSearchTerm } from '@features/management-shared-appointments';
import type { DataSource } from '@ui/data-source';

/** The endpoint's own cap on `$top`. Every page size the grid offers fits under it. */
const CUSTOMERS_MAX_TOP = 100;

/** The row members that hold a shop-local day (`Edm.Date`), not an instant. */
export const CUSTOMER_DATE_FIELDS = [
  'firstVisitDate',
  'lastVisitDate',
  'lastNoShowDate',
  'customerSince',
] as const satisfies readonly (keyof CustomerODataResponse)[];

/**
 * What the grid and the drawer over it share.
 *
 * `autoProvided: false` and provided by `CustomersList`, so each visit starts a new store and
 * shows its skeleton. The drawer, a child route in the page's outlet, reads the same one.
 */
@Service({ autoProvided: false })
export class CustomersStore {
  private readonly api = inject(CustomersApi);
  private readonly access = inject(StaffAccessStore);

  /** Bumped by a write in the drawer or by the toolbar's refresh. The grid reloads on it. */
  readonly revision = signal(0);

  /** The shop's zone. The browser's until the workspace sends one. */
  readonly timezone = computed(
    () => this.access.company()?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  /** Every staff member of the shop, inactive ones included, by display name. */
  readonly staff = computed<readonly WorkspaceStaffMemberViewDto[]>(() => this.access.staff());

  /** Who a customer can prefer from now on. An inactive barber is never offered again. */
  readonly activeBarbers = computed(() => this.staff().filter((member) => member.isActive));

  /** The spend columns and amounts exist only for this right. */
  readonly canSeeSpend = computed(() => this.access.has('analytics:read'));

  /**
   * The list, filtered, sorted and paged by the endpoint.
   *
   * The API applies no order of its own, so a query without a sort is sorted by name. A search
   * term is folded and quoted as the booking form's customer search does it.
   */
  readonly customers: DataSource<CustomerODataResponse> = odataSource<CustomerODataResponse>({
    fetch: (query) => {
      const search = query.search === undefined ? '' : customerSearchTerm(query.search);
      return this.api.list({
        ...query,
        search: search === '' ? undefined : search,
        orderBy: query.orderBy ?? 'displayName',
      });
    },
    key: { selector: 'id', type: 'uuid' },
    capabilities: { maxTop: CUSTOMERS_MAX_TOP, search: true },
    guidFields: ['id', 'preferredStaffMemberId'],
    dateFields: CUSTOMER_DATE_FIELDS,
    normalizedFields: { displayName: 'nameNormalized' },
  });

  reload(): void {
    this.revision.update((value) => value + 1);
  }
}
