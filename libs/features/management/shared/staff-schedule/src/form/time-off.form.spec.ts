import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { formEditor } from '@util/forms';

import {
  emptyTimeOff,
  TIME_OFF_FIELDS,
  timeOffForm,
  timeOffLiveRules,
  timeOffRequest,
  timeOffRules,
} from './time-off.form';

describe('the time-off form', () => {
  it('sends whole days without times, and an empty reason as null', () => {
    const value = {
      ...emptyTimeOff('2026-10-05'),
      startTime: '10:00',
      endTime: '12:00',
      reason: '  ',
    };
    expect(timeOffRequest(value)).toEqual({
      startsOn: '2026-10-05',
      endsOn: '2026-10-05',
      startTime: null,
      endTime: null,
      reason: null,
    });
  });

  it('sends both times for part of a day, and the reason trimmed', () => {
    const value = {
      startsOn: '2026-10-05',
      endsOn: '2026-10-05',
      wholeDays: false,
      startTime: '10:00',
      endTime: '12:00',
      reason: ' Dentist ',
    };
    expect(timeOffRequest(value)).toMatchObject({
      startTime: '10:00',
      endTime: '12:00',
      reason: 'Dentist',
    });
  });

  it('reads a time off with no times as whole days', () => {
    expect(
      timeOffForm({
        id: 't1',
        startsOn: '2026-10-05',
        endsOn: '2026-10-07',
        startTime: null,
        endTime: null,
        reason: null,
      }),
    ).toMatchObject({ wholeDays: true, startTime: '', reason: '' });
  });

  // Regression: the times showed no asterisk until a save had already refused them.
  it('marks the times required before a save once whole days is off', () => {
    const editor = formEditor({
      model: signal(emptyTimeOff('2026-10-05')),
      fields: TIME_OFF_FIELDS,
      rules: timeOffRules,
      liveRules: timeOffLiveRules,
      action: () => Promise.resolve(undefined),
      injector: TestBed.inject(Injector),
    });

    expect(editor.form.startTime().required()).toBe(false);

    editor.form.wholeDays().value.set(false);

    expect(editor.committed()).toBe(false);
    expect(editor.form.startTime().required()).toBe(true);
    expect(editor.form.endTime().required()).toBe(true);
    expect(editor.form.startTime().errors()).toEqual([]);
  });
});
