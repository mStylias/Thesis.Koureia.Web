import { Component, computed, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { RadioGroup, type RadioOption } from '@ui/radio-group';
import { Switch } from '@ui/switch';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import { injectCalendarCopy } from '../core/calendar-copy';
import type { CalendarDayColumns, CalendarTimeScale, CalendarView } from '../calendar.types';

const TIME_SCALES: readonly CalendarTimeScale[] = [5, 10, 30, 60];

let nextId = 0;

/**
 * The calendar's own settings: minutes per row, and what day view's columns
 * stand for.
 *
 * ```html
 * <lib-calendar-settings [view]="view()" [(timeScale)]="scale" [(dayColumns)]="columns" />
 * ```
 *
 * The column switch shows in day view only, the one view it changes.
 */
@Component({
  selector: 'lib-calendar-settings',
  templateUrl: './calendar-settings.html',
  styleUrl: './calendar-settings.scss',
  imports: [TranslocoPipe, UiCopyPipe, RadioGroup, Switch],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
  host: { class: 'cs-host' },
})
export class CalendarSettings {
  /** The view on show. Decides whether the column switch is drawn. */
  readonly view = input<CalendarView>('week');

  readonly timeScale = model<CalendarTimeScale>(30);

  readonly dayColumns = model<CalendarDayColumns>('single');

  /** Whether tiles show their times. Drawn in the views that have tiles. */
  readonly showTime = model(false);

  /** Text of the column switch. Falls back to a generic label. */
  readonly dayColumnsLabel = input('');

  protected readonly scaleHeadingId = `lib-calendar-settings-scale-${(nextId++).toString()}`;

  private readonly copy = injectCalendarCopy();

  protected readonly scaleOptions = computed<readonly RadioOption<CalendarTimeScale>[]>(() => {
    const unit = this.copy('calendar.minutes');
    return TIME_SCALES.map((minutes) => ({
      value: minutes,
      label: `${minutes.toString()} ${unit}`,
    }));
  });

  protected onScalePick(value: CalendarTimeScale | null): void {
    if (value !== null) {
      this.timeScale.set(value);
    }
  }

  protected readonly hasTiles = computed(() => {
    const view = this.view();
    return view === 'day' || view === 'week' || view === 'month';
  });

  protected onColumnsToggle(perResource: boolean): void {
    this.dayColumns.set(perResource ? 'perResource' : 'single');
  }
}
