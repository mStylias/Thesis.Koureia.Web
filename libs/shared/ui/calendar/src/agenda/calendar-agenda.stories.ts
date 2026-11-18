import { Component, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { addMonths, todayLocal } from '@ui/date-picker';
import { monthOf } from '../core/date-math';
import { DEMO_RESOURCES, demoMonthEvents } from '../demo/calendar-demo-data';
import { CalendarAgenda } from './calendar-agenda';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const TODAY = todayLocal();

@Component({
  selector: 'lib-calendar-agenda-demo',
  imports: [CalendarAgenda],
  template: `
    <div style="max-width: 56rem; display: grid; grid-template-rows: 32rem auto; gap: 0.75rem;">
      <lib-calendar-agenda
        [anchor]="anchor()"
        [events]="events"
        [resources]="resources"
        [(selectedEventId)]="selectedEventId"
        (eventOpen)="status.set('Άνοιγμα: ' + $event.title)"
      />
      <p style="margin: 0; color: var(--text-secondary);">{{ status() }}</p>
    </div>
  `,
})
class CalendarAgendaDemo {
  readonly anchor = input(TODAY);
  readonly events = demoMonthEvents(TODAY);
  readonly resources = DEMO_RESOURCES;
  readonly selectedEventId = signal<string | null>(null);
  readonly status = signal('Κάνε κλικ σε μια καταχώρηση.');
}

const meta: Meta<CalendarAgendaDemo> = {
  title: 'Layout & Navigation/Calendar/Agenda',
  component: CalendarAgendaDemo,
  decorators: [
    moduleMetadata({ imports: [CalendarAgendaDemo] }),
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
<lib-calendar-agenda
  [anchor]="anchor()"
  [events]="events()"
  [resources]="resources()"
  [(selectedEventId)]="openId"
  (eventOpen)="open($event)"
/>
`;

export const Agenda: StoryObj<CalendarAgendaDemo> = {
  render: () => ({ template: '<lib-calendar-agenda-demo />' }),
  parameters: doc(
    'The month as a list grouped by day, with sticky day heads. Days with nothing are skipped, and the list opens on today.',
    USAGE,
  ),
};

const NEXT_MONTH = `${addMonths(monthOf(TODAY), 1)}-01`;

export const Empty: StoryObj<CalendarAgendaDemo> = {
  render: () => ({ template: `<lib-calendar-agenda-demo anchor="${NEXT_MONTH}" />` }),
  parameters: doc('A month with nothing in it says so.', USAGE),
};
