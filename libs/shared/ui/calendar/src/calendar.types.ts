import type { LucideIconInput } from '@lucide/angular';
import type { DateValue, IsoWeekday } from '@ui/date-picker';
import type { TimeValue } from '@ui/time-picker';

/**
 * The calendar's vocabulary. Nothing here names a domain: an event has a title,
 * a resource and a badge, and the host decides what those are.
 */

/** The hue of a badge, from the semantic set. `neutral` is text on a plain surface. */
export type CalendarBadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

/** A short state shown on a tile, as text first and a tone second. */
export interface CalendarBadge {
  readonly label: string;
  readonly tone: CalendarBadgeTone;
  readonly icon?: LucideIconInput;
}

/** One of the six categorical swatches the theme provides for resources. */
export type CalendarSwatch = 1 | 2 | 3 | 4 | 5 | 6;

/** One timed entry on one day. Dates and times are local to the host's time zone. */
export interface CalendarEvent {
  readonly id: string;
  /** `YYYY-MM-DD`. */
  readonly date: DateValue;
  /** `HH:mm`, inclusive. */
  readonly start: TimeValue;
  /** `HH:mm`, exclusive. An end at or before the start is read as the end of the day. */
  readonly end: TimeValue;
  readonly title: string;
  readonly subtitle?: string;
  /** Picks the swatch and, in per-resource day columns, the column. */
  readonly resourceId?: string;
  readonly badge?: CalendarBadge;
  /** Drawn desaturated, with the time struck through. */
  readonly muted?: boolean;
  /** Small glyphs beside the title, each also read out in the event's name. */
  readonly marks?: readonly CalendarEventMark[];
}

/** A fact worth seeing on the tile, as an icon. The label is its tooltip and its spoken text. */
export interface CalendarEventMark {
  readonly icon: LucideIconInput;
  readonly label: string;
  /** Defaults to `neutral`, the text colour. */
  readonly tone?: CalendarBadgeTone;
}

/** Something events belong to: a column in per-resource day view and a swatch everywhere. */
export interface CalendarResource {
  readonly id: string;
  readonly label: string;
  readonly swatch: CalendarSwatch;
  /** One or two letters for the narrowest tiles. */
  readonly initials?: string;
}

/** The open hours of one weekday. A weekday with no entry is closed. */
export interface CalendarHours {
  readonly weekday: IsoWeekday;
  /** `HH:mm`, inclusive. */
  readonly open: TimeValue;
  /** `HH:mm`, exclusive. */
  readonly close: TimeValue;
}

export type CalendarView = 'day' | 'week' | 'month' | 'year' | 'agenda';

/** Minutes per row of the time grid. */
export type CalendarTimeScale = 5 | 10 | 30 | 60;

/** What the columns of day view stand for. */
export type CalendarDayColumns = 'single' | 'perResource';

/** Which panel the side drawer shows. `null` is closed. */
export type CalendarPanel = 'filters' | 'settings' | null;

/** The dates a view draws. `end` is exclusive. */
export interface CalendarRange {
  readonly start: DateValue;
  readonly end: DateValue;
  readonly view: CalendarView;
}

/** A place on the calendar a user pointed at: a day, a time in it, a column's resource. */
export interface CalendarSlot {
  readonly date: DateValue;
  readonly time?: TimeValue;
  readonly resourceId?: string;
}

/**
 * One column of the time grid. Day view is one column, week view seven, and
 * per-resource day view one per resource, all on the same date.
 */
export interface CalendarColumn {
  readonly date: DateValue;
  /** Set when the column holds one resource's events only. */
  readonly resourceId?: string;
}

/** A step the facade is animating: which way the dates moved, and which of two names restarts it. */
export interface CalendarSlide {
  readonly direction: 'next' | 'previous';
  readonly parity: number;
}

/** Which way a view switch went: to a finer view, to a broader one, or across. */
export type CalendarZoom = 'in' | 'out' | 'none';
