import { Component, computed, input, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { todayLocal } from '@ui/date-picker';
import type {
  CalendarColumn,
  CalendarEvent,
  CalendarHours,
  CalendarResource,
  CalendarSlot,
  CalendarTimeScale,
} from '../calendar.types';
import { isoWeekdayOf, timeOf, weekDays } from '../core/date-math';
import { CalendarTimeGrid } from './calendar-time-grid';

/**
 * A per-story description plus an explicit "Show code" snippet. Every example renders through a
 * demo component, so the generated source would otherwise show the demo tag, not the API.
 */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const TODAY = todayLocal();
const WEEK = weekDays(TODAY, 1);

const RESOURCES: readonly CalendarResource[] = [
  { id: 'a', label: 'Θέση Α', swatch: 1, initials: 'Α' },
  { id: 'b', label: 'Θέση Β', swatch: 2, initials: 'Β' },
  { id: 'c', label: 'Θέση Γ', swatch: 3, initials: 'Γ' },
];

const HOURS: readonly CalendarHours[] = [
  { weekday: 1, open: '09:00', close: '20:00' },
  { weekday: 2, open: '09:00', close: '20:00' },
  { weekday: 3, open: '09:00', close: '20:00' },
  { weekday: 4, open: '09:00', close: '20:00' },
  { weekday: 5, open: '09:00', close: '20:00' },
  { weekday: 6, open: '09:00', close: '16:00' },
];

const TITLES = ['Ελένη Π.', 'Νίκος Κ.', 'Μαρία Δ.', 'Γιώργος Α.', 'Άννα Σ.', 'Κώστας Μ.'];
const SUBTITLES = ['Συνάντηση', 'Παρουσίαση', 'Επισκόπηση', 'Συμβουλευτική'];
const BADGES: readonly CalendarEvent['badge'][] = [
  { label: 'Επιβεβαιωμένο', tone: 'success' },
  undefined,
  { label: 'Σε αναμονή', tone: 'warning' },
];

/** Fictional demo content, anchored to the current week so the now line shows. */
function demoEvents(): readonly CalendarEvent[] {
  const events: CalendarEvent[] = [];
  WEEK.forEach((date, day) => {
    if (isoWeekdayOf(date) === 7) {
      return;
    }
    RESOURCES.forEach((resource, index) => {
      for (let slot = 0; slot < 4; slot += 1) {
        const start = 9 * 60 + ((day * 3 + index * 2 + slot * 5) % 9) * 60 + (slot % 2) * 30;
        const length = [30, 45, 60, 90][(day + index + slot) % 4] ?? 30;
        const serial = day * 20 + index * 5 + slot;
        events.push({
          id: `${date}-${resource.id}-${slot.toString()}`,
          date,
          start: timeOf(start),
          end: timeOf(start + length),
          title: TITLES[serial % TITLES.length] ?? '',
          subtitle: SUBTITLES[serial % SUBTITLES.length],
          resourceId: resource.id,
          badge: BADGES[serial % BADGES.length],
          muted: serial % 11 === 0,
        });
      }
    });
  });
  // A crowd on one hour of today, to show the chip.
  for (let index = 0; index < 6; index += 1) {
    events.push({
      id: `crowd-${index.toString()}`,
      date: TODAY,
      start: timeOf(14 * 60 + index * 5),
      end: timeOf(15 * 60),
      title: TITLES[index] ?? '',
      resourceId: 'a',
    });
  }
  return events;
}

const EVENTS = demoEvents();

type DemoMode = 'day' | 'week' | 'perResource';

@Component({
  selector: 'lib-calendar-time-grid-demo',
  imports: [CalendarTimeGrid],
  template: `
    <div style="display: grid; grid-template-rows: 34rem auto; gap: 0.75rem; max-width: 72rem;">
      <lib-calendar-time-grid
        [columns]="columns()"
        [events]="events"
        [resources]="resources"
        [hours]="hours"
        [timeScale]="scale()"
        [(selectedEventId)]="selectedEventId"
        (eventOpen)="opened.set($event)"
        (slotCreate)="created.set($event)"
      />
      <p style="margin: 0; color: var(--text-secondary);">{{ status() }}</p>
    </div>
  `,
})
class CalendarTimeGridDemo {
  readonly mode = input<DemoMode>('day');
  readonly scale = input<CalendarTimeScale>(30);

  readonly events = EVENTS;
  readonly resources = RESOURCES;
  readonly hours = HOURS;
  readonly selectedEventId = signal<string | null>(null);
  readonly opened = signal<CalendarEvent | null>(null);
  readonly created = signal<CalendarSlot | null>(null);

  readonly columns = computed<readonly CalendarColumn[]>(() => {
    switch (this.mode()) {
      case 'day':
        return [{ date: TODAY }];
      case 'week':
        return WEEK.map((date) => ({ date }));
      case 'perResource':
        return RESOURCES.map((resource) => ({ date: TODAY, resourceId: resource.id }));
    }
  });

  readonly status = computed(() => {
    const created = this.created();
    const opened = this.opened();
    if (created !== null) {
      return `Δημιουργία: ${created.date} ${created.time ?? ''} ${created.resourceId ?? ''}`.trim();
    }
    if (opened !== null) {
      return `Άνοιγμα: ${opened.title}`;
    }
    return 'Κάνε κλικ σε μια καταχώρηση, ή διπλό κλικ σε κενό χώρο.';
  });
}

const meta: Meta<CalendarTimeGridDemo> = {
  title: 'Layout & Navigation/Calendar/Time grid',
  component: CalendarTimeGridDemo,
  decorators: [
    moduleMetadata({ imports: [CalendarTimeGridDemo] }),
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
<lib-calendar-time-grid
  [columns]="[{ date: anchor }]"
  [events]="events()"
  [resources]="resources()"
  [hours]="hours()"
  [timeScale]="30"
  [timezone]="timezone"
  [(selectedEventId)]="openId"
  (eventOpen)="open($event)"
  (slotCreate)="create($event)"
/>
`;

export const Day: StoryObj<CalendarTimeGridDemo> = {
  render: () => ({ template: '<lib-calendar-time-grid-demo mode="day" />' }),
  parameters: doc(
    [
      'One column for the day. The axis is all 24 hours with the closed ones shaded, and the',
      'grid opens on the first open hour. Overlapping events share the column up to four wide;',
      'the rest sit behind a "+N" chip. Click a tile to open it, double click empty space to',
      'create there.',
    ].join(' '),
    USAGE,
  ),
};

export const Week: StoryObj<CalendarTimeGridDemo> = {
  render: () => ({ template: '<lib-calendar-time-grid-demo mode="week" />' }),
  parameters: doc(
    'Seven columns, Monday first. Today is marked in the head and carries the now line.',
    USAGE.replace('[{ date: anchor }]', 'weekDays(anchor, 1).map((date) => ({ date }))'),
  ),
};

export const PerResource: StoryObj<CalendarTimeGridDemo> = {
  render: () => ({ template: '<lib-calendar-time-grid-demo mode="perResource" />' }),
  parameters: doc(
    [
      'One column per resource on one day. The head names the resource, so the tiles drop',
      "their initials, and a slot created here carries the column's `resourceId`.",
    ].join(' '),
    USAGE.replace(
      '[{ date: anchor }]',
      'resources().map((resource) => ({ date: anchor, resourceId: resource.id }))',
    ),
  ),
};

export const FineScale: StoryObj<CalendarTimeGridDemo> = {
  render: () => ({ template: '<lib-calendar-time-grid-demo mode="day" [scale]="5" />' }),
  parameters: doc(
    'Five-minute rows. An hour grows to twelve rows of the slot floor; the top hour stays put across a scale change.',
    USAGE.replace('[timeScale]="30"', '[timeScale]="5"'),
  ),
};
