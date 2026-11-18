import type { DateValue } from '@ui/date-picker';
import type { CalendarEvent, CalendarResource } from '../calendar.types';
import type { PackedTile } from '../core/tile-layout.types';

/** A tile the grid draws: the event, its resource and its place in the column. */
export interface TimeGridTile {
  readonly event: CalendarEvent;
  readonly resource: CalendarResource | null;
  readonly layout: PackedTile;
}

/** The events a column had no room for, behind one chip. */
export interface TimeGridOverflow {
  readonly key: string;
  readonly start: number;
  readonly end: number;
  readonly events: readonly CalendarEvent[];
}

/** A span of minutes drawn as outside the open hours. */
export interface TimeGridBand {
  readonly start: number;
  readonly end: number;
}

/** One column with everything the template needs already resolved. */
export interface TimeGridColumn {
  readonly key: string;
  readonly date: DateValue;
  readonly resourceId: string | null;
  readonly resource: CalendarResource | null;
  /** What the head shows: the resource's label, or the short weekday and day. */
  readonly heading: string;
  /** The column's accessible name: the resource's label, or the full date. */
  readonly label: string;
  readonly today: boolean;
  /** No open hours on this weekday. */
  readonly closed: boolean;
  /** The first open minute, or `null` when closed. */
  readonly open: number | null;
  readonly bands: readonly TimeGridBand[];
  readonly tiles: readonly TimeGridTile[];
  readonly overflow: readonly TimeGridOverflow[];
}

/** What the open hours of one weekday mean for a column. */
export interface TimeGridHours {
  readonly closed: boolean;
  /** The first open minute, or `null` when closed. */
  readonly open: number | null;
  readonly bands: readonly TimeGridBand[];
}
