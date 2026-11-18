import type { AppointmentCatalogResponse } from '@api/appointments';

import {
  addMinutes,
  draftLength,
  draftLines,
  draftTotal,
  endsAfter,
  fitsAll,
  freeTimes,
  fromMinutes,
  nextEnd,
  serviceOptions,
  toMinutes,
} from './appointment-draft';
import type { DraftPricing } from './appointment-draft.types';

const CUT = 'cut';
const BEARD = 'beard';
const WASH = 'wash';

const CATALOG: AppointmentCatalogResponse = {
  currency: 'EUR',
  slotIntervalMinutes: 15,
  serviceCategories: [
    {
      id: 'hair',
      name: 'Hair',
      services: [
        { id: CUT, name: 'Cut' },
        { id: WASH, name: 'Wash' },
      ],
    },
  ],
  uncategorizedServices: [{ id: BEARD, name: 'Beard' }],
  staffMembers: [
    {
      id: 'nikos',
      offerings: [
        { serviceId: CUT, price: 15, durationMinutes: 30 },
        { serviceId: BEARD, price: 10, durationMinutes: 20 },
      ],
    },
    {
      id: 'maria',
      offerings: [
        { serviceId: CUT, price: 20, durationMinutes: 45 },
        { serviceId: WASH, price: 5, durationMinutes: 10 },
      ],
    },
  ],
};

const CREATE: DraftPricing = { catalog: CATALOG, booked: null };

describe('times', () => {
  it('reads and writes HH:mm as minutes after midnight', () => {
    expect(toMinutes('09:05')).toBe(545);
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes('')).toBeNull();
    expect(fromMinutes(545)).toBe('09:05');
    expect(fromMinutes(1440)).toBeNull();
  });

  it('refuses a time past midnight: an appointment is one date', () => {
    expect(addMinutes('23:30', 20)).toBe('23:50');
    expect(addMinutes('23:30', 30)).toBeNull();
  });

  it('knows an end after its start', () => {
    expect(endsAfter('10:00', '10:30')).toBe(true);
    expect(endsAfter('10:00', '10:00')).toBe(false);
    expect(endsAfter('10:00', '')).toBe(false);
  });
});

describe('serviceOptions', () => {
  it('lists the categories first, then the uncategorized services', () => {
    expect(serviceOptions(CATALOG).map((option) => [option.id, option.category])).toEqual([
      [CUT, 'Hair'],
      [WASH, 'Hair'],
      [BEARD, null],
    ]);
  });

  it('keeps a booked service the catalog no longer offers, so an edit still shows it', () => {
    const options = serviceOptions(CATALOG, [
      { serviceId: 'perm', name: 'Perm' },
      { serviceId: CUT, name: 'Cut' },
    ]);

    expect(options.map((option) => option.id)).toEqual([CUT, WASH, BEARD, 'perm']);
  });
});

describe('draftLines', () => {
  it('prices each line from the barber’s own offering', () => {
    const lines = draftLines(CREATE, 'maria', [CUT, WASH]);

    expect(lines.map((line) => [line.price, line.durationMinutes])).toEqual([
      [20, 45],
      [5, 10],
    ]);
    expect(draftTotal(lines)).toBe(25);
    expect(draftLength(lines)).toBe(55);
  });

  it('marks a service the barber does not perform', () => {
    const lines = draftLines(CREATE, 'nikos', [CUT, WASH]);

    expect(lines.map((line) => line.offered)).toEqual([true, false]);
    expect(fitsAll(CREATE, 'nikos', [CUT, WASH])).toBe(false);
    expect(fitsAll(CREATE, 'maria', [CUT, WASH])).toBe(true);
  });

  it('prices nothing before a barber is chosen', () => {
    expect(draftLines(CREATE, '', [CUT]).map((line) => line.offered)).toEqual([false]);
  });

  describe('on an edit', () => {
    const booked = (startPassed: boolean): DraftPricing => ({
      catalog: CATALOG,
      booked: {
        staffMemberId: 'nikos',
        startPassed,
        services: [
          { serviceId: CUT, name: 'Cut', categoryId: 'hair', price: 12, durationMinutes: 25 },
          { serviceId: 'perm', name: 'Perm', categoryId: null, price: 40, durationMinutes: 60 },
        ],
      },
    });

    describe('of a future appointment', () => {
      const future = booked(false);

      it('keeps the booked lines while services and barber stay as booked', () => {
        const lines = draftLines(future, 'nikos', ['perm', CUT]);

        expect(lines.map((line) => [line.serviceId, line.price])).toEqual([
          ['perm', 40],
          [CUT, 12],
        ]);
      });

      it('re-prices every line from today’s offering once a service is added', () => {
        const lines = draftLines(future, 'nikos', [CUT, BEARD]);

        expect(lines.map((line) => [line.serviceId, line.price, line.durationMinutes])).toEqual([
          [CUT, 15, 30],
          [BEARD, 10, 20],
        ]);
      });

      it('re-prices every line from the new barber', () => {
        expect(draftLines(future, 'maria', [CUT]).map((line) => line.price)).toEqual([20]);
      });

      it('drops a booked service nobody offers any more once it is re-priced', () => {
        expect(fitsAll(future, 'nikos', ['perm', BEARD])).toBe(false);
      });
    });

    describe('of a past appointment', () => {
      const past = booked(true);

      it('keeps the booked price of a kept line and prices an added one from today’s offering', () => {
        const lines = draftLines(past, 'nikos', [CUT, BEARD]);

        expect(lines.map((line) => [line.serviceId, line.price])).toEqual([
          [CUT, 12],
          [BEARD, 10],
        ]);
      });

      it('keeps the booked price after a barber change', () => {
        const lines = draftLines(past, 'maria', [CUT]);

        expect(lines.map((line) => [line.price, line.durationMinutes, line.offered])).toEqual([
          [12, 25, true],
        ]);
      });

      it('keeps a booked service the barber no longer offers, as booked', () => {
        expect(draftLines(past, 'nikos', ['perm'])).toEqual([
          { serviceId: 'perm', name: 'Perm', price: 40, durationMinutes: 60, offered: true },
        ]);
      });

      it('still refuses a new barber who does not perform a kept service', () => {
        expect(fitsAll(past, 'maria', [CUT, 'perm'])).toBe(false);
      });

      it('matches a duplicate to one booked line each', () => {
        expect(draftLines(past, 'nikos', [CUT, CUT]).map((line) => line.price)).toEqual([12, 15]);
      });
    });
  });
});

describe('nextEnd', () => {
  const at = (start: string, end: string, overridden = false) => ({ start, end, overridden });

  it('follows the start and the length without an override', () => {
    expect(nextEnd(at('10:00', '10:30'), at('11:00', '10:30'), 30)).toBe('11:30');
    expect(nextEnd(at('10:00', '10:30'), at('10:00', '10:30'), 45)).toBe('10:45');
  });

  it('has no end before there is a start and a service', () => {
    expect(nextEnd(at('', ''), at('', ''), 30)).toBe('');
    expect(nextEnd(at('10:00', ''), at('10:00', ''), 0)).toBe('');
  });

  it('keeps an overridden end when the services change', () => {
    expect(nextEnd(at('10:00', '11:00', true), at('10:00', '11:00', true), 30)).toBe('11:00');
  });

  it('moves an overridden end with the start, so the length holds', () => {
    expect(nextEnd(at('10:00', '11:00', true), at('10:30', '11:00', true), 30)).toBe('11:30');
  });

  it('leaves an overridden end alone when moving it would pass midnight', () => {
    expect(nextEnd(at('10:00', '23:00', true), at('11:30', '23:00', true), 30)).toBe('23:00');
  });
});

describe('freeTimes', () => {
  const slots = [
    { time: '09:00', startsAtUtc: '2026-09-24T06:00:00Z', staffMemberIds: ['nikos', 'maria'] },
    { time: '09:15', startsAtUtc: '2026-09-24T06:15:00Z', staffMemberIds: ['maria'] },
  ];

  it('keeps every time when no barber is chosen', () => {
    expect(freeTimes(slots, '')).toEqual(['09:00', '09:15']);
  });

  it('keeps the times the chosen barber is free', () => {
    expect(freeTimes(slots, 'nikos')).toEqual(['09:00']);
  });
});
