import type { DateValue } from '@ui/date-picker';
import type { CalendarEvent, CalendarResource } from '../calendar.types';

/** One event in a cell, with its resource and its start already formatted. */
export interface MonthCellEvent {
  readonly event: CalendarEvent;
  readonly resource: CalendarResource | null;
  readonly start: string;
  readonly end: string;
}

/** One day of the grid, with everything that does not depend on the cell's size. */
export interface MonthCell {
  readonly date: DateValue;
  readonly day: number;
  /** A leading or trailing day of another month. */
  readonly outside: boolean;
  readonly today: boolean;
  readonly closed: boolean;
  /** The full date, for the cell's accessible name. */
  readonly label: string;
  readonly events: readonly MonthCellEvent[];
}

export interface MonthRow {
  readonly key: string;
  readonly cells: readonly MonthCell[];
}

/** A cell trimmed to what fits: the rows on show and how many the chip stands for. */
export interface MonthCellView {
  readonly cell: MonthCell;
  readonly visible: readonly MonthCellEvent[];
  readonly hidden: readonly MonthCellEvent[];
}

export interface MonthRowView {
  readonly key: string;
  readonly cells: readonly MonthCellView[];
}
