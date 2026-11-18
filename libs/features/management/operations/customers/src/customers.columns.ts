import { where } from '@ui/data-source';
import {
  booleanColumn,
  currencyColumn,
  dateColumn,
  datetimeColumn,
  numberColumn,
  tagColumn,
  textColumn,
  type ColumnDef,
  type HeaderFilterOption,
} from '@ui/datagrid';
import type { CustomerODataResponse } from '@api/customers';

import type { CustomerColumnsDeps } from './customers.columns.types';
import { formatDay, formatInstant } from './customers.format';

/** Column ids. The quick filter and the specs address columns by these. */
export const COLUMN = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  account: 'account',
  visits: 'visits',
  lastVisit: 'lastVisit',
  daysSinceLastVisit: 'daysSinceLastVisit',
  nextAppointment: 'nextAppointment',
  upcomingCount: 'upcomingCount',
  noShows: 'noShows',
  lastNoShow: 'lastNoShow',
  cancellations: 'cancellations',
  preferredBarber: 'preferredBarber',
  blocked: 'blocked',
  hasNote: 'hasNote',
  firstVisit: 'firstVisit',
  customerSince: 'customerSince',
  totalSpend: 'totalSpend',
  averageSpend: 'averageSpend',
} as const;

/** The spend columns, which exist only with `analytics:read`. */
export const SPEND_COLUMNS: readonly string[] = [COLUMN.totalSpend, COLUMN.averageSpend];

/** From this many no-shows the count reads as a warning. */
export const NO_SHOW_WARNING = 2;

/** A column whose only filter is the header's list. */
const HEADER_ONLY = { rowFiltering: false } as const;

/** A column whose only filter is the filter row. */
const ROW_ONLY = { headerFiltering: false } as const;

/**
 * Every column of the grid, in order. The shown ones come first in the chooser's order.
 *
 * The spend columns are left out, not hidden, without `analytics:read`: the chooser, the filter
 * builder and the export then never offer them, and a saved view that names them drops them.
 * The API refuses a spend filter or sort from such a caller.
 */
export function customerColumns(
  deps: CustomerColumnsDeps,
): readonly ColumnDef<CustomerODataResponse>[] {
  const t = deps.translate;
  const caption = (id: string): string => t(`managementCustomers.columns.${id}`);
  const day = (value: unknown): string => formatDay(value, deps.language);
  // The column holds `isWalkIn`, so an account holder is `false` and reads "Yes".
  const accountLabel = (value: unknown): string =>
    value === false
      ? t('managementCustomers.yes')
      : value === true
        ? t('managementCustomers.no')
        : '';
  const blocked = t('managementCustomers.blocked');

  const columns: ColumnDef<CustomerODataResponse>[] = [
    textColumn<CustomerODataResponse>({
      id: COLUMN.name,
      field: 'displayName',
      caption: caption('name'),
      primary: true,
      minWidth: 200,
      allow: ROW_ONLY,
    }),
    textColumn<CustomerODataResponse>({
      id: COLUMN.email,
      field: 'email',
      caption: caption('email'),
      minWidth: 200,
      filter: { defaultOperator: 'contains' },
      allow: ROW_ONLY,
    }),
    textColumn<CustomerODataResponse>({
      id: COLUMN.phone,
      field: 'phoneNumber',
      caption: caption('phone'),
      minWidth: 150,
      filter: { defaultOperator: 'contains' },
      allow: ROW_ONLY,
    }),
    numberColumn<CustomerODataResponse>({
      id: COLUMN.visits,
      field: 'visitCount',
      caption: caption('visits'),
      tooltip: t('managementCustomers.visitsTooltip'),
      minWidth: 110,
      allow: ROW_ONLY,
    }),
    dateColumn<CustomerODataResponse>({
      id: COLUMN.lastVisit,
      field: 'lastVisitDate',
      caption: caption('lastVisit'),
      minWidth: 150,
      format: day,
      allow: ROW_ONLY,
    }),
    numberColumn<CustomerODataResponse>({
      id: COLUMN.daysSinceLastVisit,
      field: 'daysSinceLastVisit',
      caption: caption('daysSinceLastVisit'),
      minWidth: 150,
      visible: false,
      filter: { defaultOperator: 'ge' },
      allow: ROW_ONLY,
    }),
    datetimeColumn<CustomerODataResponse>({
      id: COLUMN.nextAppointment,
      field: 'nextAppointmentAt',
      caption: caption('nextAppointment'),
      minWidth: 190,
      format: (value) => formatInstant(value, deps.language, deps.timezone),
      allow: ROW_ONLY,
    }),
    numberColumn<CustomerODataResponse>({
      id: COLUMN.upcomingCount,
      field: 'upcomingCount',
      caption: caption('upcomingCount'),
      minWidth: 120,
      visible: false,
      allow: ROW_ONLY,
    }),
    // The grid's `decorateCell` gives the count its warning tone from NO_SHOW_WARNING.
    numberColumn<CustomerODataResponse>({
      id: COLUMN.noShows,
      field: 'noShowCount',
      caption: caption('noShows'),
      minWidth: 110,
      allow: ROW_ONLY,
    }),
    dateColumn<CustomerODataResponse>({
      id: COLUMN.lastNoShow,
      field: 'lastNoShowDate',
      caption: caption('lastNoShow'),
      minWidth: 160,
      visible: false,
      format: day,
      allow: ROW_ONLY,
    }),
    numberColumn<CustomerODataResponse>({
      id: COLUMN.cancellations,
      field: 'cancellationCount',
      caption: caption('cancellations'),
      minWidth: 120,
      visible: false,
      allow: ROW_ONLY,
    }),
    // Filtered by id, never by name: a name is not unique, and a renamed barber would drop out
    // of a saved view.
    textColumn<CustomerODataResponse>({
      id: COLUMN.preferredBarber,
      field: 'preferredStaffDisplayName',
      caption: caption('preferredBarber'),
      minWidth: 180,
      // The inactive mark reads a member no other column selects.
      requires: { select: ['preferredStaffIsActive'] },
      value: (row) =>
        row.preferredStaffDisplayName === null
          ? ''
          : row.preferredStaffIsActive === false
            ? t('managementCustomers.inactiveBarber', { name: row.preferredStaffDisplayName })
            : row.preferredStaffDisplayName,
      filter: { headerFilterOptions: barberOptions(deps) },
      allow: HEADER_ONLY,
    }),
    // A tag only for a blocked customer. An empty list draws nothing.
    tagColumn<CustomerODataResponse>(
      {
        id: COLUMN.blocked,
        field: 'isBlocked',
        caption: caption('blocked'),
        minWidth: 150,
        value: (row) => (row.isBlocked ? [blocked] : []),
        filter: {
          headerFilterOptions: [
            { label: blocked, node: where('isBlocked', 'eq', true) },
            { label: t('managementCustomers.notBlocked'), node: where('isBlocked', 'eq', false) },
          ],
        },
        allow: HEADER_ONLY,
      },
      { tone: 'error' },
    ),
    tagColumn<CustomerODataResponse>(
      {
        id: COLUMN.account,
        field: 'isWalkIn',
        caption: caption('account'),
        minWidth: 150,
        filter: {
          headerFilterOptions: [
            { label: accountLabel(false), node: where('isWalkIn', 'eq', false) },
            { label: accountLabel(true), node: where('isWalkIn', 'eq', true) },
          ],
        },
        allow: HEADER_ONLY,
      },
      {
        tone: (value) => (value === false ? 'accent' : 'neutral'),
        label: (value) => accountLabel(value),
      },
    ),

    // In the column chooser.
    booleanColumn<CustomerODataResponse>(
      {
        id: COLUMN.hasNote,
        field: 'hasNote',
        caption: caption('hasNote'),
        minWidth: 110,
        visible: false,
        allow: ROW_ONLY,
      },
      { display: 'check' },
    ),
    dateColumn<CustomerODataResponse>({
      id: COLUMN.firstVisit,
      field: 'firstVisitDate',
      caption: caption('firstVisit'),
      minWidth: 150,
      visible: false,
      format: day,
      allow: ROW_ONLY,
    }),
    dateColumn<CustomerODataResponse>({
      id: COLUMN.customerSince,
      field: 'customerSince',
      caption: caption('customerSince'),
      minWidth: 150,
      visible: false,
      format: day,
      allow: ROW_ONLY,
    }),
  ];

  if (deps.canSeeSpend) {
    columns.push(
      currencyColumn<CustomerODataResponse>(
        {
          id: COLUMN.totalSpend,
          field: 'totalSpend',
          caption: caption('totalSpend'),
          minWidth: 140,
          visible: false,
          allow: ROW_ONLY,
        },
        { precision: 2 },
      ),
      currencyColumn<CustomerODataResponse>(
        {
          id: COLUMN.averageSpend,
          field: 'averageSpend',
          caption: caption('averageSpend'),
          minWidth: 160,
          visible: false,
          allow: ROW_ONLY,
        },
        { precision: 2 },
      ),
    );
  }

  return columns;
}

/**
 * Every staff member, inactive ones marked, then "No preference". A customer can still name a
 * barber who has left, so the filter offers them too.
 */
function barberOptions(deps: CustomerColumnsDeps): readonly HeaderFilterOption[] {
  return [
    ...deps.staff.map((member) => ({
      label: member.isActive
        ? member.displayName
        : deps.translate('managementCustomers.inactiveBarber', { name: member.displayName }),
      node: where('preferredStaffMemberId', 'eq', member.id),
    })),
    {
      label: deps.translate('managementCustomers.noPreference'),
      node: where('preferredStaffMemberId', 'isNull'),
    },
  ];
}
