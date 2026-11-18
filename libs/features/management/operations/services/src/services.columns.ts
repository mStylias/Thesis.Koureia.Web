import { where } from '@ui/data-source';
import {
  currencyColumn,
  datetimeColumn,
  numberColumn,
  tagColumn,
  textColumn,
  type ColumnDef,
  type HeaderFilterOption,
  type HeaderFilterSource,
} from '@ui/datagrid';
import type { ServiceODataResponse, ServiceOptionStaffMemberViewDto } from '@api/services';

import type { ServiceColumnsDeps } from './services.columns.types';

/** Column ids. The specs address columns by these. */
export const COLUMN = {
  name: 'name',
  category: 'category',
  price: 'price',
  duration: 'duration',
  barbers: 'barbers',
  status: 'status',
  bookableOnline: 'bookableOnline',
  priceRange: 'priceRange',
  bufferBefore: 'bufferBefore',
  bufferAfter: 'bufferAfter',
  calendarMinutes: 'calendarMinutes',
  description: 'description',
  timesBooked: 'timesBooked',
  lastBookedAt: 'lastBookedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} as const;

/** A column whose only filter is the header's list. */
const HEADER_ONLY = { rowFiltering: false } as const;

/** A column whose only filter is the filter row. */
const ROW_ONLY = { headerFiltering: false } as const;

/**
 * Every column of the grid. The first six show, the rest wait in the column chooser.
 *
 * Header filters test ids, never names: `categoryId` and `staff/staffMemberId`.
 */
export function serviceColumns(
  deps: ServiceColumnsDeps,
): readonly ColumnDef<ServiceODataResponse>[] {
  const t = deps.translate;
  const caption = (id: string): string => t(`managementServices.columns.${id}`);
  const minutes = (value: unknown): string =>
    typeof value === 'number' ? t('managementServices.minutes', { count: value }) : '';
  const yesNo = (value: unknown): string =>
    value === true
      ? t('managementServices.yes')
      : value === false
        ? t('managementServices.no')
        : '';
  const statusLabel = (value: unknown): string =>
    value === true
      ? t('managementServices.status.active')
      : value === false
        ? t('managementServices.status.inactive')
        : '';
  const none = t('managementServices.noBarbers');
  const money = new Intl.NumberFormat(deps.language, {
    style: 'currency',
    currency: deps.currency,
    minimumFractionDigits: 2,
  });

  return [
    textColumn<ServiceODataResponse>({
      id: COLUMN.name,
      field: 'name',
      caption: caption('name'),
      primary: true,
      minWidth: 220,
      sort: { order: 'asc' },
      allow: ROW_ONLY,
    }),
    textColumn<ServiceODataResponse>({
      id: COLUMN.category,
      field: 'categoryName',
      caption: caption('category'),
      minWidth: 170,
      format: (value) =>
        typeof value === 'string' && value !== '' ? value : t('managementServices.uncategorized'),
      filter: { headerFilterOptions: categoryOptions(deps) },
      allow: HEADER_ONLY,
    }),
    currencyColumn<ServiceODataResponse>(
      {
        id: COLUMN.price,
        field: 'price',
        caption: caption('price'),
        minWidth: 110,
        allow: ROW_ONLY,
      },
      { currency: deps.currency, precision: 2 },
    ),
    numberColumn<ServiceODataResponse>({
      id: COLUMN.duration,
      field: 'durationMinutes',
      caption: caption('duration'),
      minWidth: 110,
      format: minutes,
      allow: ROW_ONLY,
    }),
    // Active barbers only: an inactive one takes no booking. None is a warning, because online
    // customers cannot book the service.
    tagColumn<ServiceODataResponse>(
      {
        id: COLUMN.barbers,
        field: 'staff',
        caption: caption('barbers'),
        minWidth: 200,
        value: (row) => {
          const names = row.staff
            .filter((member) => member.isActive)
            .map((member) => member.displayName);
          return names.length === 0 ? [none] : names;
        },
        filter: { headerFilterSource: barberFilter(deps) },
        allow: { ...HEADER_ONLY, sorting: false, grouping: false },
      },
      { tone: (value) => (value === none ? 'warning' : 'neutral') },
    ),
    tagColumn<ServiceODataResponse>(
      {
        id: COLUMN.status,
        field: 'isActive',
        caption: caption('status'),
        minWidth: 120,
        filter: {
          headerFilterOptions: [
            { label: statusLabel(true), node: where('isActive', 'eq', true) },
            { label: statusLabel(false), node: where('isActive', 'eq', false) },
          ],
        },
        allow: HEADER_ONLY,
      },
      {
        tone: (value) => (value === true ? 'success' : 'neutral'),
        label: (value) => statusLabel(value),
      },
    ),

    // In the column chooser.
    tagColumn<ServiceODataResponse>(
      {
        id: COLUMN.bookableOnline,
        field: 'isBookableOnline',
        caption: caption('bookableOnline'),
        minWidth: 140,
        visible: false,
        filter: {
          headerFilterOptions: [
            { label: yesNo(true), node: where('isBookableOnline', 'eq', true) },
            { label: yesNo(false), node: where('isBookableOnline', 'eq', false) },
          ],
        },
        allow: HEADER_ONLY,
      },
      {
        tone: (value) => (value === true ? 'success' : 'warning'),
        label: (value) => yesNo(value),
      },
    ),
    textColumn<ServiceODataResponse>({
      id: COLUMN.priceRange,
      field: 'maxPrice',
      caption: caption('priceRange'),
      minWidth: 130,
      visible: false,
      value: (row) => priceRange(money, row.minPrice, row.maxPrice),
      allow: { rowFiltering: false, headerFiltering: false, grouping: false },
    }),
    numberColumn<ServiceODataResponse>({
      id: COLUMN.bufferBefore,
      field: 'bufferBeforeMinutes',
      caption: caption('bufferBefore'),
      minWidth: 110,
      visible: false,
      format: minutes,
      allow: ROW_ONLY,
    }),
    numberColumn<ServiceODataResponse>({
      id: COLUMN.bufferAfter,
      field: 'bufferAfterMinutes',
      caption: caption('bufferAfter'),
      minWidth: 110,
      visible: false,
      format: minutes,
      allow: ROW_ONLY,
    }),
    numberColumn<ServiceODataResponse>({
      id: COLUMN.calendarMinutes,
      field: 'calendarMinutes',
      caption: caption('calendarMinutes'),
      minWidth: 130,
      visible: false,
      format: minutes,
      allow: ROW_ONLY,
    }),
    textColumn<ServiceODataResponse>({
      id: COLUMN.description,
      field: 'description',
      caption: caption('description'),
      minWidth: 220,
      visible: false,
      allow: ROW_ONLY,
    }),
    numberColumn<ServiceODataResponse>({
      id: COLUMN.timesBooked,
      field: 'timesBooked',
      caption: caption('timesBooked'),
      minWidth: 110,
      visible: false,
      allow: ROW_ONLY,
    }),
    datetimeColumn<ServiceODataResponse>({
      id: COLUMN.lastBookedAt,
      field: 'lastBookedAt',
      caption: caption('lastBookedAt'),
      minWidth: 170,
      visible: false,
      allow: ROW_ONLY,
    }),
    datetimeColumn<ServiceODataResponse>({
      id: COLUMN.createdAt,
      field: 'createdAt',
      caption: caption('createdAt'),
      minWidth: 170,
      visible: false,
      allow: ROW_ONLY,
    }),
    datetimeColumn<ServiceODataResponse>({
      id: COLUMN.updatedAt,
      field: 'updatedAt',
      caption: caption('updatedAt'),
      minWidth: 170,
      visible: false,
      allow: ROW_ONLY,
    }),
  ];
}

/** The shop's categories by id, and "Uncategorized", which no id names. */
function categoryOptions(deps: ServiceColumnsDeps): readonly HeaderFilterOption[] {
  return [
    ...deps.categories.map((category) => ({
      label: category.name,
      node: where('categoryId', 'eq', category.id),
    })),
    {
      label: deps.translate('managementServices.uncategorized'),
      node: where('categoryId', 'isNull'),
    },
  ];
}

function barberFilter(
  deps: ServiceColumnsDeps,
): HeaderFilterSource<ServiceOptionStaffMemberViewDto> {
  return {
    source: deps.barbers,
    field: 'staff.staffMemberId',
    value: (barber) => barber.id,
    label: (barber) =>
      barber.isActive
        ? barber.displayName
        : deps.translate('managementServices.inactiveBarber', { name: barber.displayName }),
  };
}

/** `16,00 €` for one price, `16,00 € – 25,00 €` for a range, empty without an active barber. */
export function priceRange(
  money: Intl.NumberFormat,
  min: number | null,
  max: number | null,
): string {
  if (min === null || max === null) return '';
  if (min === max) return money.format(min);
  return `${money.format(min)} – ${money.format(max)}`;
}
