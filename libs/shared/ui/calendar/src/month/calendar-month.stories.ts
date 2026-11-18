import { Component, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { todayLocal } from '@ui/date-picker';
import type { CalendarSlot } from '../calendar.types';
import { DEMO_HOURS, DEMO_RESOURCES, demoMonthEvents } from '../demo/calendar-demo-data';
import { CalendarMonth } from './calendar-month';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const TODAY = todayLocal();

@Component({
  selector: 'lib-calendar-month-demo',
  imports: [CalendarMonth],
  template: `
    <div
      [style.max-width]="width()"
      style="display: grid; grid-template-rows: 40rem auto; gap: 0.75rem;"
    >
      <lib-calendar-month
        [anchor]="anchor"
        [events]="events"
        [resources]="resources"
        [hours]="hours"
        [(selectedEventId)]="selectedEventId"
        (eventOpen)="status.set('Άνοιγμα: ' + $event.title)"
        (dayOpen)="status.set('Ημέρα: ' + $event)"
        (slotCreate)="onCreate($event)"
      />
      <p style="margin: 0; color: var(--text-secondary);">{{ status() }}</p>
    </div>
  `,
})
class CalendarMonthDemo {
  readonly width = input('72rem');
  readonly anchor = TODAY;
  readonly events = demoMonthEvents(TODAY);
  readonly resources = DEMO_RESOURCES;
  readonly hours = DEMO_HOURS;
  readonly selectedEventId = signal<string | null>(null);
  readonly status = signal(
    'Κάνε κλικ σε μια καταχώρηση, στον αριθμό μιας ημέρας, ή διπλό κλικ σε κενό.',
  );

  protected onCreate(slot: CalendarSlot): void {
    this.status.set(`Δημιουργία: ${slot.date}`);
  }
}

const meta: Meta<CalendarMonthDemo> = {
  title: 'Layout & Navigation/Calendar/Month',
  component: CalendarMonthDemo,
  decorators: [
    moduleMetadata({ imports: [CalendarMonthDemo] }),
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

const USAGE = `
<lib-calendar-month
  [anchor]="anchor()"
  [events]="events()"
  [resources]="resources()"
  [hours]="hours()"
  [(selectedEventId)]="openId"
  (eventOpen)="open($event)"
  (dayOpen)="showDay($event)"
  (slotCreate)="create($event)"
/>
`;

export const Month: StoryObj<CalendarMonthDemo> = {
  render: () => ({ template: '<lib-calendar-month-demo />' }),
  parameters: doc(
    [
      'Whole weeks, Monday first. A cell lists its day in start order and trims to the rows',
      'that fit, the last one going to a "+N" chip. The day number opens the day; a double',
      'click on empty space creates there. The arrow keys walk the cells.',
    ].join(' '),
    USAGE,
  ),
};

export const Narrow: StoryObj<CalendarMonthDemo> = {
  render: () => ({ template: '<lib-calendar-month-demo width="30rem" />' }),
  parameters: doc(
    "Below the cell width floor the rows become swatch dots, and the count moves into each cell's accessible name.",
    USAGE,
  ),
};
