import { Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { CalendarMarks } from '../marks/calendar-marks';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import { injectCalendarCopy } from '../core/calendar-copy';
import type { CalendarEvent, CalendarResource } from '../calendar.types';
import { eventNameParts } from '../core/event-label';
import { timeLabel } from '../core/range-label';

/**
 * One event on the time grid, drawn on the host `<button>`.
 *
 * ```html
 * <button
 *   type="button"
 *   libCalendarTile
 *   #tile="libCalendarTile"
 *   [event]="event"
 *   [resource]="resource"
 *   [attr.aria-label]="tile.label()"
 * ></button>
 * ```
 *
 * The host binds the accessible name itself, from `label`, so a template
 * lint can see that the button has one. The grid positions the host through `--tile-start`, `--tile-end`,
 * `--tile-column` and `--tile-columns`; the tile owns what is inside. The
 * swatch comes from the resource and the state from the badge, and both are
 * repeated as text, so nothing here is colour alone. Below two lines of
 * height the subtitle and the badge give way, decided by a container query
 * on the tile itself rather than by measuring text.
 */
@Component({
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: 'button[libCalendarTile]',
  exportAs: 'libCalendarTile',
  templateUrl: './calendar-tile.html',
  styleUrl: './calendar-tile.scss',
  imports: [CalendarMarks, LucideDynamicIcon],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
  host: {
    class: 'tile',
    '[attr.data-swatch]': 'resource()?.swatch ?? null',
    '[attr.data-muted]': 'event().muted ? "" : null',
    '[attr.data-selected]': 'selected() ? "" : null',
    '[attr.aria-current]': 'selected() ? "true" : null',
  },
})
export class CalendarTile {
  /** The event this tile stands for. */
  readonly event = input.required<CalendarEvent>();

  /** The event's resource, for the swatch and the initials. `null` draws a neutral tile. */
  readonly resource = input<CalendarResource | null>(null);

  /** Marks the tile the host has open. */
  readonly selected = input(false);

  /** Locale for the times. */
  readonly locale = input('el');

  /**
   * Whether the tile names its resource. Off in per-resource columns, where
   * the column head already does.
   */
  readonly showResource = input(true);

  /** Whether the tile shows its times. The accessible name carries them either way. */
  readonly showTime = input(false);

  /** The host's noun for a resource, spoken before its name. Empty names the resource alone. */
  readonly resourceLabel = input('');

  protected readonly start = computed(() => timeLabel(this.event().start, this.locale()));
  protected readonly end = computed(() => timeLabel(this.event().end, this.locale()));

  /** Two letters when the resource gives none. */
  protected readonly initials = computed(() => {
    const resource = this.resource();
    if (resource === null) {
      return '';
    }
    return resource.initials ?? resource.label.slice(0, 2);
  });

  private readonly copy = injectCalendarCopy();

  /**
   * The accessible name: times, title, then the resource and the badge when
   * there are any. The resource is skipped where the column already names it.
   * The host binds it as `aria-label`.
   */
  readonly label = computed(() =>
    [
      this.copy('calendar.eventLabel', {
        start: this.start(),
        end: this.end(),
        title: this.event().title,
      }),
      ...eventNameParts(
        this.showResource() ? this.resource() : null,
        this.event().badge,
        this.resourceLabel(),
        this.event().marks,
      ),
    ].join(', '),
  );
}
