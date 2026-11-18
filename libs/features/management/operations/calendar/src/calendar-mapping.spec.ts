import type { CalendarStaffMemberViewDto } from '@api/appointments';

import {
  countActiveFilters,
  emptyFilters,
  filtersEqual,
  matchesFilters,
  toCalendarEvent,
  toCalendarHours,
  toCalendarResources,
  visibleResources,
} from './calendar-mapping';
import type { CalendarAppointmentRow } from './calendar.types';

const NIKOS = '0192a0c1-7d44-7a1b-9e2f-3c1d2b4a5e6f';
const MARIA = '0192a0c1-7d44-7a1b-9e2f-3c1d2b4a5e70';
const HAIR = 'cat-hair';
const BEARD = 'cat-beard';

function staff(id: string, isActive = true): CalendarStaffMemberViewDto {
  return { id, displayName: id, initials: 'Χ', avatarUrl: null, isActive };
}

function appointment(overrides: Partial<CalendarAppointmentRow> = {}): CalendarAppointmentRow {
  return {
    id: 'a1',
    staffMemberId: NIKOS,
    customerId: 'c1',
    customerDisplayName: 'Γιώργος Παπαδόπουλος',
    localDate: '2026-09-22',
    localStartTime: '10:30',
    localEndTime: '11:15',
    status: 'confirmed',
    services: [
      { serviceId: 's1', name: 'Κούρεμα', categoryId: HAIR, durationMinutes: 30 },
      { serviceId: 's2', name: 'Γένια', categoryId: BEARD, durationMinutes: 15 },
    ],
    customerIsBlocked: false,
    customerHasNote: false,
    ...overrides,
  };
}

const copy = {
  status: (status: string) => `label:${status}`,
  blocked: 'Blocked',
  note: 'Note',
};

describe('toCalendarEvent', () => {
  it('marks a blocked customer and a shop note beside the name, and names both', () => {
    const event = toCalendarEvent(
      appointment({ customerIsBlocked: true, customerHasNote: true }),
      copy,
    );

    expect(event.marks?.map((mark) => [mark.label, mark.tone])).toEqual([
      ['Blocked', 'error'],
      ['Note', undefined],
    ]);
  });

  it('carries no marks for a customer with neither', () => {
    expect(toCalendarEvent(appointment(), copy).marks).toBeUndefined();
  });

  it('titles the tile with the customer and lists the services', () => {
    const event = toCalendarEvent(appointment(), copy);

    expect(event).toMatchObject({
      id: 'a1',
      date: '2026-09-22',
      start: '10:30',
      end: '11:15',
      title: 'Γιώργος Παπαδόπουλος',
      subtitle: 'Κούρεμα • Γένια',
      resourceId: NIKOS,
      badge: { label: 'label:confirmed', tone: 'info' },
      muted: false,
    });
  });

  it('mutes cancelled and no-show appointments', () => {
    expect(toCalendarEvent(appointment({ status: 'cancelled' }), copy).muted).toBe(true);
    expect(toCalendarEvent(appointment({ status: 'no_show' }), copy).muted).toBe(true);
  });

  it('keeps a status it does not know as neutral text', () => {
    const event = toCalendarEvent(appointment({ status: 'on_hold' }), copy);

    expect(event.badge).toEqual({ label: 'label:on_hold', tone: 'neutral' });
  });
});

describe('toCalendarHours', () => {
  it('merges a split shift into its earliest open and latest close', () => {
    const hours = toCalendarHours([
      { dayOfWeek: 1, openTime: '17:00', closeTime: '21:00' },
      { dayOfWeek: 1, openTime: '09:00', closeTime: '14:00' },
      { dayOfWeek: 6, openTime: '09:00', closeTime: '16:00' },
    ]);

    expect(hours).toEqual([
      { weekday: 1, open: '09:00', close: '21:00' },
      { weekday: 6, open: '09:00', close: '16:00' },
    ]);
  });

  it('drops a weekday outside ISO 1 to 7', () => {
    expect(toCalendarHours([{ dayOfWeek: 0, openTime: '09:00', closeTime: '17:00' }])).toEqual([]);
  });
});

describe('resources', () => {
  const roster = [staff(NIKOS), staff(MARIA, false)];
  const all = toCalendarResources(roster);

  it('takes the swatch from the roster position', () => {
    expect(all.map((resource) => resource.swatch)).toEqual([1, 2]);
  });

  it('shows the active barbers, and an inactive one only while it has appointments on screen', () => {
    expect(visibleResources(all, roster, [], new Set()).map((r) => r.id)).toEqual([NIKOS]);
    expect(visibleResources(all, roster, [], new Set([MARIA])).map((r) => r.id)).toEqual([
      NIKOS,
      MARIA,
    ]);
  });

  it('shows exactly the barbers the filter names', () => {
    expect(visibleResources(all, roster, [MARIA], new Set()).map((r) => r.id)).toEqual([MARIA]);
  });
});

describe('filters', () => {
  it('matches every facet the way the server does', () => {
    const row = appointment();

    expect(matchesFilters(row, emptyFilters())).toBe(true);
    expect(matchesFilters(row, { ...emptyFilters(), barberIds: [MARIA] })).toBe(false);
    expect(matchesFilters(row, { ...emptyFilters(), statuses: ['pending'] })).toBe(false);
    expect(matchesFilters(row, { ...emptyFilters(), categoryIds: [BEARD] })).toBe(true);
    expect(matchesFilters(row, { ...emptyFilters(), categoryIds: ['other'] })).toBe(false);
  });

  it('counts the facets that narrow the book', () => {
    expect(
      countActiveFilters({ ...emptyFilters(), barberIds: [NIKOS, MARIA], statuses: ['pending'] }),
    ).toBe(2);
  });

  it('compares presets without regard to order', () => {
    expect(
      filtersEqual(
        { ...emptyFilters(), barberIds: [NIKOS, MARIA] },
        { ...emptyFilters(), barberIds: [MARIA, NIKOS] },
      ),
    ).toBe(true);
  });
});
