import { isCalendarView } from '@ui/calendar';
import type { CalendarDayColumns, CalendarTimeScale, CalendarView } from '@ui/calendar';

import { filtersEqual } from './calendar-mapping';
import type { CalendarFilters, CalendarSettings, CalendarViewState } from './calendar.types';

/** The user resource that holds {@link CalendarSettings}. */
export const SETTINGS_RESOURCE = 'calendar_settings';

/** The saved views' host key. The resource is `calendar_main_views`. */
export const VIEWS_KEY = 'calendar_main';

export const DEFAULT_SETTINGS: CalendarSettings = {
  version: 1,
  view: 'week',
  timeScale: 30,
  dayColumns: 'single',
  showTime: false,
};

const TIME_SCALES: readonly number[] = [5, 10, 30, 60];

/**
 * A stored settings document, or `null` when it is not one. A member of the wrong shape falls
 * back to its default: one bad value does not discard the others.
 */
export function readSettings(value: unknown): CalendarSettings | null {
  if (!isRecord(value) || value['version'] !== 1) return null;
  const view = value['view'];
  const timeScale = value['timeScale'];
  const dayColumns = value['dayColumns'];
  return {
    version: 1,
    view: isView(view) ? view : DEFAULT_SETTINGS.view,
    timeScale: isTimeScale(timeScale) ? timeScale : DEFAULT_SETTINGS.timeScale,
    dayColumns: isDayColumns(dayColumns) ? dayColumns : DEFAULT_SETTINGS.dayColumns,
    showTime:
      typeof value['showTime'] === 'boolean' ? value['showTime'] : DEFAULT_SETTINGS.showTime,
  };
}

export function settingsEqual(a: CalendarSettings, b: CalendarSettings): boolean {
  return (
    a.view === b.view &&
    a.timeScale === b.timeScale &&
    a.dayColumns === b.dayColumns &&
    a.showTime === b.showTime
  );
}

/**
 * Whether a stored view state is one this page can apply. All of it or none: half a saved
 * arrangement applied is worse than none.
 */
export function isCalendarViewState(value: unknown): value is CalendarViewState {
  if (!isRecord(value) || value['version'] !== 1) return false;
  const filters = value['filters'];
  return (
    isRecord(filters) &&
    (['barberIds', 'customerIds', 'statuses', 'categoryIds'] as const).every((facet) =>
      isStringList(filters[facet]),
    ) &&
    isView(value['view']) &&
    isTimeScale(value['timeScale']) &&
    isDayColumns(value['dayColumns']) &&
    typeof value['showTime'] === 'boolean'
  );
}

/** Whether two saved views are the same arrangement. Decides whether the strip shows a change. */
export function viewStatesEqual(a: CalendarViewState, b: CalendarViewState): boolean {
  return (
    filtersEqual(a.filters, b.filters) &&
    a.view === b.view &&
    a.timeScale === b.timeScale &&
    a.dayColumns === b.dayColumns &&
    a.showTime === b.showTime
  );
}

/** A copy of stored filters, so applying a view never hands out the view's own arrays. */
export function copyFilters(filters: CalendarFilters): CalendarFilters {
  return {
    barberIds: [...filters.barberIds],
    customerIds: [...filters.customerIds],
    statuses: [...filters.statuses],
    categoryIds: [...filters.categoryIds],
  };
}

function isView(value: unknown): value is CalendarView {
  return typeof value === 'string' && isCalendarView(value);
}

function isTimeScale(value: unknown): value is CalendarTimeScale {
  return typeof value === 'number' && TIME_SCALES.includes(value);
}

function isDayColumns(value: unknown): value is CalendarDayColumns {
  return value === 'single' || value === 'perResource';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
