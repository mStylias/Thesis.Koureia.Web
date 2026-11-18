import { Component, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { Tooltip } from '@ui/tooltip';

import type { CalendarEventMark } from '../calendar.types';

/**
 * An event's marks, as glyphs beside its title. Decorative to assistive technology: the event's
 * accessible name already reads each label. The tooltip is for the pointer.
 */
@Component({
  selector: 'lib-calendar-marks',
  imports: [LucideDynamicIcon, Tooltip],
  template: `
    @for (mark of marks(); track $index) {
      <span
        class="mark"
        aria-hidden="true"
        [attr.data-tone]="mark.tone ?? null"
        [libTooltip]="mark.label"
      >
        <svg [lucideIcon]="mark.icon"></svg>
      </span>
    }
  `,
  styleUrl: './calendar-marks.scss',
})
export class CalendarMarks {
  readonly marks = input<readonly CalendarEventMark[]>([]);
}
