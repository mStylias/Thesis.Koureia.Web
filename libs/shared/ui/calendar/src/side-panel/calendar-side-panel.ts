import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, linkedSignal, model, type TemplateRef } from '@angular/core';
import { Drawer, DrawerFooter } from '@ui/drawer';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import { injectCalendarCopy } from '../core/calendar-copy';
import type {
  CalendarDayColumns,
  CalendarPanel,
  CalendarTimeScale,
  CalendarView,
} from '../calendar.types';
import { CalendarSettings } from '../settings/calendar-settings';
import type { CalendarPanelKind } from '../toolbar/calendar-toolbar.types';

/**
 * The drawer beside the calendar: the host's filters, or the calendar's own
 * settings.
 *
 * ```html
 * <lib-calendar-side-panel
 *   [(panel)]="panel"
 *   [overlay]="narrow()"
 *   [filtersTemplate]="filters"
 *   [(timeScale)]="scale"
 *   [(dayColumns)]="columns"
 * />
 * ```
 *
 * It pushes the calendar aside, or slides over it when `overlay` is set. It is
 * non-modal in both modes: a modal dialog paints above every overlay, so the
 * lists the host's filters open would draw behind it. Swapping one panel for
 * the other cross-fades the body and never closes the drawer.
 */
@Component({
  selector: 'lib-calendar-side-panel',
  templateUrl: './calendar-side-panel.html',
  styleUrl: './calendar-side-panel.scss',
  imports: [NgTemplateOutlet, Drawer, DrawerFooter, CalendarSettings],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
  host: {
    class: 'sp-host',
    '[attr.data-overlay]': 'overlay() ? "" : null',
    '[attr.data-open]': 'panel() !== null ? "" : null',
  },
})
export class CalendarSidePanel {
  /** The panel on show. `null` closes the drawer. */
  readonly panel = model<CalendarPanel>(null);

  /** Slide over the calendar instead of pushing it. */
  readonly overlay = input(false);

  /** The view on show, for the settings that apply to one view only. */
  readonly view = input<CalendarView>('week');

  readonly timeScale = model<CalendarTimeScale>(30);

  readonly dayColumns = model<CalendarDayColumns>('single');

  readonly showTime = model(false);

  readonly dayColumnsLabel = input('');

  /** The host's filters. */
  readonly filtersTemplate = input<TemplateRef<unknown> | null>(null);

  /** The footer of the filters panel, such as a "clear all" button. */
  readonly filterActionsTemplate = input<TemplateRef<unknown> | null>(null);

  /** The panel whose body is drawn. It stays through the drawer's exit, so the body does not blank. */
  protected readonly shown = linkedSignal<CalendarPanel, CalendarPanelKind>({
    source: this.panel,
    computation: (panel, previous) => panel ?? previous?.value ?? 'filters',
  });

  /** The last change swapped one open panel for the other. Only a swap animates the body. */
  protected readonly swapped = linkedSignal<CalendarPanel, boolean>({
    source: this.panel,
    computation: (panel, previous) =>
      panel !== null && previous !== undefined && previous.source !== null,
  });

  private readonly copy = injectCalendarCopy();

  protected readonly header = computed(() => {
    return this.copy(this.shown() === 'settings' ? 'calendar.settings' : 'calendar.filters');
  });

  protected readonly hasFooter = computed(
    () => this.shown() === 'filters' && this.filterActionsTemplate() !== null,
  );

  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.panel.set(null);
    }
  }
}
