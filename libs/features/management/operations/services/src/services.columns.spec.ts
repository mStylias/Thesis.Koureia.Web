import type { ServiceCategoryResponse, ServiceODataResponse } from '@api/services';
import { createArraySource, where } from '@ui/data-source';
import { readPresetOptions, type ColumnDef, type TagSpec } from '@ui/datagrid';

import { COLUMN, priceRange, serviceColumns } from './services.columns';

const CATEGORY: ServiceCategoryResponse = {
  id: 'c1',
  name: 'Κουρέματα',
  isOwned: false,
  serviceCount: 3,
  translations: [],
};

const ROW: ServiceODataResponse = {
  id: 's1',
  name: 'Κούρεμα',
  description: null,
  categoryId: 'c1',
  categoryName: 'Κουρέματα',
  price: 16,
  currency: 'EUR',
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 5,
  calendarMinutes: 35,
  isActive: true,
  staff: [
    {
      staffMemberId: 'b1',
      displayName: 'Νίκος Π.',
      isActive: true,
      customPrice: null,
      customDurationMinutes: null,
    },
    {
      staffMemberId: 'b2',
      displayName: 'Γιώργος Κ.',
      isActive: false,
      customPrice: null,
      customDurationMinutes: null,
    },
  ],
  staffCount: 1,
  minPrice: 16,
  maxPrice: 16,
  isBookableOnline: true,
  timesBooked: 4,
  lastBookedAt: null,
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: null,
};

function columns(): readonly ColumnDef<ServiceODataResponse>[] {
  return serviceColumns({
    translate: (key) => key,
    language: 'el',
    currency: 'EUR',
    categories: [CATEGORY],
    barbers: createArraySource(() => [], { key: { selector: 'id', type: 'uuid' } }),
  });
}

function column(id: string): ColumnDef<ServiceODataResponse> {
  const found = columns().find((item) => item.id === id);
  if (found === undefined) throw new Error(`column ${id} not declared`);
  return found;
}

describe('serviceColumns', () => {
  it('shows six columns and keeps the rest in the chooser', () => {
    expect(
      columns()
        .filter((item) => item.visible !== false)
        .map((item) => item.id),
    ).toEqual([
      COLUMN.name,
      COLUMN.category,
      COLUMN.price,
      COLUMN.duration,
      COLUMN.barbers,
      COLUMN.status,
    ]);
  });

  it('opens the drawer from the name, sorted by it', () => {
    expect(column(COLUMN.name)).toMatchObject({ primary: true, sort: { order: 'asc' } });
  });

  it('filters a category by its id, and "Uncategorized" by a missing one', () => {
    expect(column(COLUMN.category).filter?.headerFilterOptions).toEqual([
      { label: 'Κουρέματα', node: where('categoryId', 'eq', 'c1') },
      { label: 'managementServices.uncategorized', node: where('categoryId', 'isNull') },
    ]);
  });

  it('filters the barbers by staff member id', () => {
    expect(column(COLUMN.barbers).filter?.headerFilterSource?.field).toBe('staff.staffMemberId');
  });

  it('lists the active barbers, and warns when there is none', () => {
    const barbers = column(COLUMN.barbers);
    const tone = readPresetOptions<TagSpec<ServiceODataResponse>>(barbers, {}).tone;

    expect(barbers.value?.(ROW)).toEqual(['Νίκος Π.']);
    const none = barbers.value?.({ ...ROW, staff: [] });
    expect(none).toEqual(['managementServices.noBarbers']);
    if (typeof tone !== 'function') throw new Error('the barbers column has no tone');
    expect(tone('managementServices.noBarbers', ROW)).toBe('warning');
    expect(tone('Νίκος Π.', ROW)).toBe('neutral');
  });
});

describe('priceRange', () => {
  const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

  it('shows one price when every barber charges the same', () => {
    expect(priceRange(money, 16, 16)).toBe('€16.00');
  });

  it('shows the lowest and the highest price', () => {
    expect(priceRange(money, 16, 25)).toBe('€16.00 – €25.00');
  });

  it('shows nothing without an active barber', () => {
    expect(priceRange(money, null, null)).toBe('');
  });
});
