import { Component, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { todayLocal } from '@ui/date-picker';
import { yearOf } from '../core/date-math';
import { DEMO_HOURS, demoDayCounts } from '../demo/calendar-demo-data';
import { CalendarYear } from './calendar-year';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const TODAY = todayLocal();

@Component({
  selector: 'lib-calendar-year-demo',
  imports: [CalendarYear],
  template: `
    <div style="max-width: 72rem; display: grid; gap: 0.75rem;">
      <lib-calendar-year
        [anchor]="anchor"
        [dayCounts]="counts"
        [hours]="hours"
        (dayOpen)="status.set('Ημέρα: ' + $event)"
      />
      <p style="margin: 0; color: var(--text-secondary);">{{ status() }}</p>
    </div>
  `,
})
class CalendarYearDemo {
  readonly anchor = TODAY;
  readonly counts = demoDayCounts(yearOf(TODAY));
  readonly hours = DEMO_HOURS;
  readonly status = signal('Κάνε κλικ σε μια ημέρα.');
}

const meta: Meta<CalendarYearDemo> = {
  title: 'Layout & Navigation/Calendar/Year',
  component: CalendarYearDemo,
  decorators: [
    moduleMetadata({ imports: [CalendarYearDemo] }),
    applicationConfig({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
          },
        }),
      ],
    }),
  ],
  parameters: { layout: 'padded' },
};

export default meta;

export const Year: StoryObj<CalendarYearDemo> = {
  render: () => ({ template: '<lib-calendar-year-demo />' }),
  parameters: doc(
    [
      'Twelve mini months, four to one per row by the host width. Each day is tinted in one of',
      'four steps by its count, which is also its tooltip and part of its name. Closed weekdays',
      'are never tinted. Click or press Enter on a day to open it.',
    ].join(' '),
    `
<lib-calendar-year
  [anchor]="anchor()"
  [dayCounts]="counts()"
  [hours]="hours()"
  (dayOpen)="showDay($event)"
/>
`,
  ),
};
