import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import type { CalendarEvent, CalendarResource } from '../calendar.types';
import { minutesOf } from '../core/date-math';
import { eventNameSuffix } from '../core/event-label';
import { CalendarMarks } from '../marks/calendar-marks';
import { timeLabel } from '../core/range-label';
import type { MoreRow } from './calendar-more-popover.types';

/**
 * The list behind a "+N" chip: the events a cell or a cluster had no room to
 * draw, one row each, in start order.
 *
 * ```html
 * <button type="button" [libPopoverTriggerFor]="more">+3</button>
 * <ng-template #more>
 *   <lib-calendar-more-popover [events]="hidden" [resources]="resources" (eventOpen)="open($event)" />
 * </ng-template>
 * ```
 *
 * It is content for a popover, not a popover: the view that owns the chip
 * opens and closes the surface, and this only reports the row that was
 * chosen.
 */
@Component({
  selector: 'lib-calendar-more-popover',
  templateUrl: './calendar-more-popover.html',
  styleUrl: './calendar-more-popover.scss',
  imports: [CalendarMarks, TranslocoPipe, UiCopyPipe],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
})
export class CalendarMorePopover {
  /** The events to list. */
  readonly events = input.required<readonly CalendarEvent[]>();

  /** The resources, for each row's swatch. */
  readonly resources = input<readonly CalendarResource[]>([]);

  /** Locale for the times. */
  readonly locale = input('el');

  /** The host's noun for a resource, spoken before its name. Empty names the resource alone. */
  readonly resourceLabel = input('');

  /** The event the host has open, marked in the list. */
  readonly selectedEventId = input<string | null>(null);

  /** A row was chosen. */
  readonly eventOpen = output<CalendarEvent>();

  /**
   * The resource and the badge, for a row's accessible name. The row draws its
   * resource as a coloured bar only, so the name is what says whose it is.
   */
  protected extras(row: MoreRow): string {
    return eventNameSuffix(row.resource, row.event.badge, this.resourceLabel(), row.event.marks);
  }

  protected readonly rows = computed<readonly MoreRow[]>(() => {
    const locale = this.locale();
    const resources = new Map(this.resources().map((resource) => [resource.id, resource]));
    return [...this.events()]
      .sort(
        (a, b) =>
          (minutesOf(a.start) ?? 0) - (minutesOf(b.start) ?? 0) || a.title.localeCompare(b.title),
      )
      .map((event) => ({
        event,
        resource: event.resourceId === undefined ? null : (resources.get(event.resourceId) ?? null),
        start: timeLabel(event.start, locale),
        end: timeLabel(event.end, locale),
      }));
  });
}
