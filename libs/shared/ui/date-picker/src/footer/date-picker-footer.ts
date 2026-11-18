import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';

/** The calendar's shortcut row: Today, and Now for a date-and-time picker. */
@Component({
  selector: 'lib-date-picker-footer',
  imports: [TranslocoPipe, UiCopyPipe],
  templateUrl: './date-picker-footer.html',
  styleUrl: './date-picker-footer.scss',
  host: {
    '[attr.data-compact]': 'compact() ? "" : null',
  },
})
export class DatePickerFooter {
  readonly showToday = input(false);
  readonly showNow = input(false);
  readonly todayDisabled = input(false);
  readonly nowDisabled = input(false);
  readonly compact = input(false);
  readonly todaySelected = output();
  readonly nowSelected = output();
}
