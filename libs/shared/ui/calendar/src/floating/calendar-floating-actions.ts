import { Component, computed, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  LucideCalendar1,
  LucideCalendarDays,
  LucideCalendarRange,
  LucideDynamicIcon,
  LucideLayoutGrid,
  LucideList,
  LucidePlus,
  type LucideIconInput,
} from '@lucide/angular';
import { Fab, FabGroup } from '@ui/fab';
import { Menu, MenuTrigger, type MenuItem } from '@ui/menu';
import { UiCopyPipe } from '@util/ui-copy';

import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import type { CalendarView } from '../calendar.types';
import { injectCalendarCopy } from '../core/calendar-copy';
import { CALENDAR_VIEWS } from '../core/toolbar-layout';

/** The glyph of each view, on its menu row and on the button while it shows. */
const VIEW_ICONS: Readonly<Record<CalendarView, LucideIconInput>> = {
  day: LucideCalendar1,
  week: LucideCalendarRange,
  month: LucideCalendarDays,
  year: LucideLayoutGrid,
  agenda: LucideList,
};

/**
 * Create and the view switch as floating buttons in the corner of the views, for a host too
 * narrow to keep them in the toolbar.
 */
@Component({
  selector: 'lib-calendar-floating-actions',
  templateUrl: './calendar-floating-actions.html',
  imports: [
    Fab,
    FabGroup,
    LucideDynamicIcon,
    LucidePlus,
    Menu,
    MenuTrigger,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
})
export class CalendarFloatingActions {
  /** The view on show. The menu writes the pick back. */
  readonly view = model.required<CalendarView>();

  /** Name of the create button. Falls back to the calendar's own. */
  readonly createLabel = input('');

  /** The create button was pressed. */
  readonly create = output();

  private readonly copy = injectCalendarCopy();

  protected readonly viewIcon = computed(() => VIEW_ICONS[this.view()]);

  protected readonly viewItems = computed<readonly MenuItem[]>(() => {
    const current = this.view();
    return CALENDAR_VIEWS.map((view) => ({
      label: this.copy(`calendar.views.${view}`),
      icon: VIEW_ICONS[view],
      checked: view === current,
      command: () => {
        this.view.set(view);
      },
    }));
  });
}
