import { convertToParamMap } from '@angular/router';

import { prefillParams, readPrefill } from './appointment-prefill';

describe('readPrefill', () => {
  it('reads the slot a create was started from', () => {
    expect(
      readPrefill(
        convertToParamMap({
          view: 'week',
          date: '2026-09-21',
          slotDate: '2026-09-24',
          slotTime: '10:30',
          barberId: 'nikos',
        }),
      ),
    ).toEqual({ localDate: '2026-09-24', localStartTime: '10:30', staffMemberId: 'nikos' });
  });

  it('reads "Book again"', () => {
    expect(readPrefill(convertToParamMap({ slotDate: '2026-09-24', rebook: 'a1' }))).toEqual({
      localDate: '2026-09-24',
      rebookId: 'a1',
    });
  });

  it('reads the customer a create starts on, under its own name', () => {
    expect(readPrefill(convertToParamMap({ customer: 'c9', customerId: 'c1' }))).toEqual({
      customerId: 'c1',
    });
  });

  it('drops a malformed member rather than passing it to the form', () => {
    expect(
      readPrefill(convertToParamMap({ slotDate: '24/09/2026', slotTime: '25:00', barberId: '' })),
    ).toEqual({});
  });
});

describe('prefillParams', () => {
  it('writes what readPrefill reads', () => {
    const prefill = {
      localDate: '2026-09-24',
      localStartTime: '10:30',
      staffMemberId: 'nikos',
      customerId: 'c1',
    };
    expect(readPrefill(convertToParamMap(prefillParams(prefill)))).toEqual(prefill);
  });
});
