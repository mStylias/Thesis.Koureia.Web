import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  toolbar: 'Calendar tools',
  previous: 'Previous',
  next: 'Next',
  goToDate: 'Go to date',
  view: 'View',
  views: {
    day: 'Day',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    agenda: 'Agenda',
  },
  filters: 'Filters',
  filtersActive: '{{count}} active',
  settings: 'Settings',
  refresh: 'Refresh',
  create: 'New entry',
  overflow: 'More',
  timeScale: 'Time scale',
  minutes: 'min',
  showTime: 'Times on entries',
  dayColumns: 'One column per resource',
  today: 'Today',
  closed: 'Closed',
  eventLabel: '{{start}} to {{end}}, {{title}}',
  more: '+{{count}}',
  moreLabel: '{{count}} more, from {{start}} to {{end}}',
  moreTitle: 'More entries',
  columnHint: 'The arrow keys pick a time. Enter creates an entry there.',
  slotSelected: 'Selected {{time}}',
  entries: '{{count}} entries',
  moreCount: '{{count}} more',
  agendaEmpty: 'Nothing this month.',
  densityLegend: 'Entries per day',
  gridHint:
    'The arrow keys move between days. Enter opens a day, Shift and Enter create an entry on it.',
};

export default en;
