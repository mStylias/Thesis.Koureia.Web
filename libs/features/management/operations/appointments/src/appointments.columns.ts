import { where } from '@ui/data-source';
import {
  booleanColumn,
  currencyColumn,
  datetimeColumn,
  numberColumn,
  tagColumn,
  textColumn,
  type ColumnDef,
  type HeaderFilterOption,
  type HeaderFilterSource,
  type RelativeDateFilter,
} from '@ui/datagrid';
import type {
  AppointmentODataResponse,
  AppointmentSource,
  CalendarStaffMemberViewDto,
  CustomerOptionODataResponse,
  ServiceOptionODataResponse,
} from '@api/appointments';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_SPECS,
  isAppointmentStatus,
  statusLabelKey,
} from '@features/management-shared-appointments';

import type { AppointmentColumnsDeps } from './appointments.columns.types';

/** Column ids. The customer view and the specs address columns by these. */
export const COLUMN = {
  startsAt: 'startsAt',
  customer: 'customer',
  barber: 'barber',
  services: 'services',
  status: 'status',
  totalPrice: 'totalPrice',
  createdAt: 'createdAt',
  localEndTime: 'localEndTime',
  durationMinutes: 'durationMinutes',
  phone: 'phone',
  email: 'email',
  hasNotes: 'hasNotes',
  source: 'source',
  rating: 'rating',
  cancelledAt: 'cancelledAt',
  cancelledBy: 'cancelledBy',
  cancellationReason: 'cancellationReason',
  updatedAt: 'updatedAt',
  customerBlocked: 'customerBlocked',
  customerHasNote: 'customerHasNote',
  customerNoShows: 'customerNoShows',
} as const;

/** "Upcoming": the page opens on the start of today onward, in the shop's zone. */
export const UPCOMING: RelativeDateFilter = { direction: 'from', amount: 0, unit: 'day' };

/** The periods the Date & time cell offers. */
const DATE_PRESETS: readonly RelativeDateFilter[] = [
  { direction: 'on', amount: 0, unit: 'day' },
  UPCOMING,
  { direction: 'on', amount: 1, unit: 'day' },
  { direction: 'next', amount: 7, unit: 'day' },
  { direction: 'last', amount: 7, unit: 'day' },
  { direction: 'last', amount: 30, unit: 'day' },
  { direction: 'before', amount: 0, unit: 'day' },
];

const SOURCES: readonly AppointmentSource[] = ['online', 'staff'];

const RATINGS = [5, 4, 3, 2, 1] as const;

/** A column whose only filter is the header's list. */
const HEADER_ONLY = { rowFiltering: false } as const;

/** A column whose only filter is the filter row. */
const ROW_ONLY = { headerFiltering: false } as const;

/**
 * Every column of the grid. The first seven show, the rest wait in the column chooser.
 *
 * Header filters test ids, never names: `customerId`, `staffMemberId`, `services/serviceId`.
 * A name is not unique, and a renamed barber would drop out of a saved view.
 */
export function appointmentColumns(
  deps: AppointmentColumnsDeps,
): readonly ColumnDef<AppointmentODataResponse>[] {
  const t = deps.translate;
  const caption = (id: string): string => t(`managementAppointmentsGrid.columns.${id}`);
  const statusLabel = (value: unknown): string =>
    typeof value === 'string' && isAppointmentStatus(value) ? t(statusLabelKey(value)) : '';
  const sourceLabel = (value: unknown): string =>
    typeof value === 'string' ? t(`managementAppointmentsGrid.source.${value}`) : '';
  const startsAt = dateTimeFormat(deps.language, deps.timezone);
  const blocked = t('managementAppointmentsGrid.blocked');

  return [
    datetimeColumn<AppointmentODataResponse>({
      id: COLUMN.startsAt,
      field: 'startsAt',
      caption: caption('startsAt'),
      primary: true,
      minWidth: 200,
      sort: { order: 'asc' },
      format: (value) => formatInstant(startsAt, value),
      filter: { initial: { relative: UPCOMING }, relativePresets: DATE_PRESETS },
      allow: ROW_ONLY,
    }),
    textColumn<AppointmentODataResponse>({
      id: COLUMN.customer,
      field: 'customerDisplayName',
      caption: caption('customer'),
      minWidth: 180,
      filter: { headerFilterSource: customerFilter(deps) },
      allow: HEADER_ONLY,
    }),
    textColumn<AppointmentODataResponse>({
      id: COLUMN.barber,
      field: 'staffDisplayName',
      caption: caption('barber'),
      minWidth: 140,
      filter: { headerFilterSource: barberFilter(deps) },
      allow: HEADER_ONLY,
    }),
    tagColumn<AppointmentODataResponse>({
      id: COLUMN.services,
      field: 'services',
      caption: caption('services'),
      minWidth: 200,
      value: (row) => row.services.map((line) => line.name),
      filter: { headerFilterSource: serviceFilter(deps) },
      allow: { ...HEADER_ONLY, sorting: false, grouping: false },
    }),
    tagColumn<AppointmentODataResponse>(
      {
        id: COLUMN.status,
        field: 'status',
        caption: caption('status'),
        minWidth: 140,
        filter: {
          headerFilterOptions: APPOINTMENT_STATUSES.map((status) => ({
            label: t(statusLabelKey(status)),
            node: where('status', 'eq', status),
          })),
        },
        allow: HEADER_ONLY,
      },
      {
        tone: (value) =>
          typeof value === 'string' && isAppointmentStatus(value)
            ? APPOINTMENT_STATUS_SPECS[value].tone
            : 'neutral',
        label: (value) => statusLabel(value),
      },
    ),
    currencyColumn<AppointmentODataResponse>(
      {
        id: COLUMN.totalPrice,
        field: 'totalPrice',
        caption: caption('totalPrice'),
        minWidth: 110,
        allow: ROW_ONLY,
      },
      { currency: 'EUR', precision: 2 },
    ),
    datetimeColumn<AppointmentODataResponse>({
      id: COLUMN.createdAt,
      field: 'createdAt',
      caption: caption('createdAt'),
      minWidth: 170,
      allow: ROW_ONLY,
    }),

    // In the column chooser.
    textColumn<AppointmentODataResponse>({
      id: COLUMN.localEndTime,
      field: 'localEndTime',
      caption: caption('localEndTime'),
      minWidth: 100,
      visible: false,
      // `HH:mm`, zero-padded, so the string order is the time order.
      filter: { operators: ['ge', 'le', 'eq'], defaultOperator: 'ge' },
      allow: ROW_ONLY,
    }),
    numberColumn<AppointmentODataResponse>({
      id: COLUMN.durationMinutes,
      field: 'durationMinutes',
      caption: caption('durationMinutes'),
      minWidth: 110,
      visible: false,
      format: (value) =>
        typeof value === 'number' ? t('managementAppointmentsGrid.minutes', { count: value }) : '',
      allow: ROW_ONLY,
    }),
    textColumn<AppointmentODataResponse>({
      id: COLUMN.phone,
      field: 'customerPhoneNumber',
      caption: caption('phone'),
      minWidth: 140,
      visible: false,
      allow: ROW_ONLY,
    }),
    textColumn<AppointmentODataResponse>({
      id: COLUMN.email,
      field: 'customerEmail',
      caption: caption('email'),
      minWidth: 180,
      visible: false,
      allow: ROW_ONLY,
    }),
    booleanColumn<AppointmentODataResponse>(
      {
        id: COLUMN.hasNotes,
        field: 'hasNotes',
        caption: caption('hasNotes'),
        minWidth: 110,
        visible: false,
        allow: ROW_ONLY,
      },
      { display: 'check' },
    ),
    tagColumn<AppointmentODataResponse>(
      {
        id: COLUMN.source,
        field: 'source',
        caption: caption('source'),
        minWidth: 140,
        visible: false,
        filter: {
          headerFilterOptions: SOURCES.map((source) => ({
            label: sourceLabel(source),
            node: where('source', 'eq', source),
          })),
        },
        allow: HEADER_ONLY,
      },
      { tone: 'neutral', label: (value) => sourceLabel(value) },
    ),
    numberColumn<AppointmentODataResponse>({
      id: COLUMN.rating,
      field: 'rating',
      caption: caption('rating'),
      minWidth: 110,
      visible: false,
      format: (value) =>
        typeof value === 'number' ? t('managementAppointmentsGrid.stars', { count: value }) : '',
      filter: { headerFilterOptions: ratingOptions(deps) },
      allow: HEADER_ONLY,
    }),
    datetimeColumn<AppointmentODataResponse>({
      id: COLUMN.cancelledAt,
      field: 'cancelledAt',
      caption: caption('cancelledAt'),
      minWidth: 170,
      visible: false,
      allow: ROW_ONLY,
    }),
    textColumn<AppointmentODataResponse>({
      id: COLUMN.cancelledBy,
      field: 'cancelledByDisplayName',
      caption: caption('cancelledBy'),
      minWidth: 150,
      visible: false,
      allow: ROW_ONLY,
    }),
    textColumn<AppointmentODataResponse>({
      id: COLUMN.cancellationReason,
      field: 'cancellationReason',
      caption: caption('cancellationReason'),
      minWidth: 200,
      visible: false,
      allow: ROW_ONLY,
    }),
    datetimeColumn<AppointmentODataResponse>({
      id: COLUMN.updatedAt,
      field: 'updatedAt',
      caption: caption('updatedAt'),
      minWidth: 170,
      visible: false,
      allow: ROW_ONLY,
    }),
    // The shop's facts about the customer, as of now rather than of the booking.
    tagColumn<AppointmentODataResponse>(
      {
        id: COLUMN.customerBlocked,
        field: 'customerIsBlocked',
        caption: caption('customerBlocked'),
        minWidth: 170,
        visible: false,
        // A tag only for a blocked customer. An empty list draws nothing.
        value: (row) => (row.customerIsBlocked ? [blocked] : []),
        filter: {
          headerFilterOptions: [
            { label: blocked, node: where('customerIsBlocked', 'eq', true) },
            {
              label: t('managementAppointmentsGrid.notBlocked'),
              node: where('customerIsBlocked', 'eq', false),
            },
          ],
        },
        allow: HEADER_ONLY,
      },
      { tone: 'error' },
    ),
    booleanColumn<AppointmentODataResponse>(
      {
        id: COLUMN.customerHasNote,
        field: 'customerHasNote',
        caption: caption('customerHasNote'),
        minWidth: 160,
        visible: false,
        allow: ROW_ONLY,
      },
      { display: 'check' },
    ),
    numberColumn<AppointmentODataResponse>({
      id: COLUMN.customerNoShows,
      field: 'customerNoShowCount',
      caption: caption('customerNoShows'),
      minWidth: 150,
      visible: false,
      allow: ROW_ONLY,
    }),
  ];
}

function customerFilter(
  deps: AppointmentColumnsDeps,
): HeaderFilterSource<CustomerOptionODataResponse> {
  return {
    source: deps.store.customers,
    field: 'customerId',
    value: (customer) => customer.id,
    // The phone or the email beside the name: two customers can share one.
    label: (customer) => {
      const contact = customer.phoneNumber ?? customer.email;
      return contact == null ? customer.displayName : `${customer.displayName} · ${contact}`;
    },
  };
}

function barberFilter(
  deps: AppointmentColumnsDeps,
): HeaderFilterSource<CalendarStaffMemberViewDto> {
  return {
    source: deps.store.barbers,
    field: 'staffMemberId',
    value: (barber) => barber.id,
    label: (barber) =>
      barber.isActive
        ? barber.displayName
        : deps.translate('managementAppointmentsGrid.inactive', { name: barber.displayName }),
  };
}

function serviceFilter(
  deps: AppointmentColumnsDeps,
): HeaderFilterSource<ServiceOptionODataResponse> {
  return {
    source: deps.store.services,
    field: 'services.serviceId',
    value: (service) => service.id,
    label: (service) =>
      service.isActive
        ? service.name
        : deps.translate('managementAppointmentsGrid.inactiveService', { name: service.name }),
  };
}

function ratingOptions(deps: AppointmentColumnsDeps): readonly HeaderFilterOption[] {
  return [
    ...RATINGS.map((rating) => ({
      label: deps.translate('managementAppointmentsGrid.stars', { count: rating }),
      node: where('rating', 'eq', rating),
    })),
    {
      label: deps.translate('managementAppointmentsGrid.notRated'),
      node: where('rating', 'isNull'),
    },
  ];
}

/** `Τρί 29 Σεπ 2026, 14:30`: the weekday is what a barber reads first. */
function dateTimeFormat(language: string, timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function formatInstant(format: Intl.DateTimeFormat, value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format.format(date);
}
