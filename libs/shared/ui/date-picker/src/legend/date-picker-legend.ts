import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';

import type { AvailabilityLevel } from '../date-picker.types';

/** The key under a calendar whose days carry availability tints. */
@Component({
  selector: 'lib-date-picker-legend',
  imports: [TranslocoPipe, UiCopyPipe],
  templateUrl: './date-picker-legend.html',
  styleUrl: './date-picker-legend.scss',
})
export class DatePickerLegend {
  protected readonly levels: readonly AvailabilityLevel[] = ['low', 'medium', 'high'];
}
