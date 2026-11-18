import { isCalendarView } from '@ui/calendar';
import { isCanonicalDate } from '@ui/date-picker';

import type { CalendarPosition, CalendarPositionParams } from './calendar.types';

/** The `columns` value of per-barber day view. */
const PER_BARBER = 'barbers';

/**
 * What the address says about the position. A member the address does not carry, or carries
 * malformed, is absent, so the persisted value fills it.
 *
 * Day view with no `columns` is single-column: the link names the view, so it names that too.
 * Any other view leaves the persisted column mode alone, since only day view uses it.
 */
export function readPosition(params: {
  get(name: string): string | null;
}): Partial<CalendarPosition> {
  const view = params.get('view');
  const date = params.get('date');
  const columns = params.get('columns');
  const position: { -readonly [K in keyof CalendarPosition]?: CalendarPosition[K] } = {};

  if (view !== null && isCalendarView(view)) {
    position.view = view;
    if (view === 'day') {
      position.dayColumns = columns === PER_BARBER ? 'perResource' : 'single';
    }
  }
  if (date !== null && isCanonicalDate(date)) {
    position.anchor = date;
  }
  return position;
}

/** The position as query parameters. `columns` is written in day view only, where it applies. */
export function positionParams(position: CalendarPosition): CalendarPositionParams {
  return {
    view: position.view,
    ...(position.anchor === '' ? {} : { date: position.anchor }),
    ...(position.view === 'day' && position.dayColumns === 'perResource'
      ? { columns: PER_BARBER }
      : {}),
  };
}
