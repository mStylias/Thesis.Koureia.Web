import {
  appointmentsFilter,
  customerAppointmentsFilter,
  dayCountsApply,
} from './appointments.query';
import type { AppointmentsQuery } from './appointments.types';

const NIKOS = '0192a0c1-7d44-7a1b-9e2f-3c1d2b4a5e6f';
const MARIA = '0192a0c1-7d44-7a1b-9e2f-3c1d2b4a5e70';
const BEARDS = '0192a0c1-8e55-7b2c-8f3a-4d2e3c5b6f70';

const WEEK: AppointmentsQuery = {
  from: '2026-09-21',
  to: '2026-09-28',
  staffMemberIds: [],
  customerIds: [],
  statuses: [],
  categoryIds: [],
};

describe('appointmentsFilter', () => {
  it('sends the range as unquoted Edm.Date literals', () => {
    expect(appointmentsFilter(WEEK)).toBe('localDate ge 2026-09-21 and localDate lt 2026-09-28');
  });

  it('renders every facet in the form the endpoint accepts', () => {
    const filter = appointmentsFilter({
      ...WEEK,
      staffMemberIds: [NIKOS, MARIA],
      statuses: ['pending', 'confirmed'],
      categoryIds: [BEARDS],
    });

    expect(filter).toBe(
      'localDate ge 2026-09-21 and localDate lt 2026-09-28' +
        ` and staffMemberId in (${NIKOS},${MARIA})` +
        " and status in ('pending','confirmed')" +
        ` and services/any(s: s/categoryId in (${BEARDS}))`,
    );
  });

  it('leaves an empty facet out rather than sending in ()', () => {
    expect(appointmentsFilter({ ...WEEK, customerIds: [] })).not.toContain('customerId');
  });

  it('drops a value that is not its literal form, so a preset cannot inject an expression', () => {
    const filter = appointmentsFilter({
      ...WEEK,
      staffMemberIds: [`${NIKOS}) or (true`],
      statuses: ["pending') or ('1"],
    });

    expect(filter).toBe('localDate ge 2026-09-21 and localDate lt 2026-09-28');
  });

  it('refuses a request with no valid range', () => {
    expect(() => appointmentsFilter({ ...WEEK, from: '' })).toThrow();
  });
});

describe('dayCountsApply', () => {
  it('filters inside $apply and groups by day', () => {
    expect(dayCountsApply({ ...WEEK, staffMemberIds: [NIKOS] })).toBe(
      'filter(localDate ge 2026-09-21 and localDate lt 2026-09-28' +
        ` and staffMemberId in (${NIKOS}))/groupby((localDate),aggregate($count as count))`,
    );
  });
});

describe('customerAppointmentsFilter', () => {
  it('names one customer', () => {
    expect(customerAppointmentsFilter(NIKOS)).toBe(`customerId eq ${NIKOS}`);
  });

  it('refuses a value that is not a GUID, which would otherwise read the whole book', () => {
    expect(() => customerAppointmentsFilter('1 or true')).toThrow();
  });
});
