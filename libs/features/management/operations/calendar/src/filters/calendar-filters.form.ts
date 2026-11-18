import { field, fields } from '@util/forms';

import type { CalendarFilters } from '../calendar.types';

/** The filters' labels. The panel has no rules: every facet may be empty, which means all. */
export const FILTER_FIELDS = fields<CalendarFilters>({
  barberIds: field({ label: 'managementCalendar.filters.barbers' }),
  customerIds: field({ label: 'managementCalendar.filters.customers' }),
  statuses: field({ label: 'managementCalendar.filters.statuses' }),
  categoryIds: field({ label: 'managementCalendar.filters.categories' }),
});
