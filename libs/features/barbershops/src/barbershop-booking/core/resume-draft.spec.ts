import { bookingDraft, bookingOptions } from '../booking.fixture';
import { applyDayCheck, applyTimeCheck, resumeDraft } from './resume-draft';

const TODAY = '2026-09-20';

describe('resumeDraft', () => {
  it('keeps a draft nothing has invalidated', () => {
    const draft = bookingDraft({
      serviceIds: ['service-haircut', 'service-beard'],
      staffMemberId: 'barber-a',
      date: '2026-09-25',
      time: '17:30',
      startsAtUtc: '2026-09-25T14:30:00Z',
      step: 'confirm',
    });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.repairs).toEqual([]);
    expect(resumed.draft).toEqual(draft);
    expect(resumed.step).toBe('confirm');
  });

  it('drops only the service that went away', () => {
    const draft = bookingDraft({
      serviceIds: ['service-haircut', 'service-gone'],
      step: 'when',
    });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.repairs).toEqual(['services-dropped']);
    expect(resumed.draft.serviceIds).toEqual(['service-haircut']);
    expect(resumed.step).toBe('services');
  });

  it('clears everything downstream when no service survives', () => {
    const draft = bookingDraft({
      serviceIds: ['service-gone'],
      staffMemberId: 'barber-a',
      date: '2026-09-25',
      time: '17:30',
      startsAtUtc: '2026-09-25T14:30:00Z',
      step: 'confirm',
    });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.repairs).toEqual(['services-cleared']);
    expect(resumed.draft.serviceIds).toEqual([]);
    expect(resumed.draft.staffMemberId).toBeNull();
    expect(resumed.draft.date).toBeNull();
    expect(resumed.draft.startsAtUtc).toBeNull();
    expect(resumed.step).toBe('services');
  });

  it('falls back to Anyone when the barber no longer performs the whole set', () => {
    // Barber B does the haircut but not the beard.
    const draft = bookingDraft({
      serviceIds: ['service-haircut', 'service-beard'],
      staffMemberId: 'barber-b',
      date: '2026-09-25',
      time: '17:30',
      startsAtUtc: '2026-09-25T14:30:00Z',
      step: 'confirm',
    });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.repairs).toEqual(['barber-cleared']);
    expect(resumed.draft.staffMemberId).toBeNull();
    // The day and the time are kept: they were not what went stale.
    expect(resumed.draft.date).toBe('2026-09-25');
    expect(resumed.draft.startsAtUtc).toBe('2026-09-25T14:30:00Z');
    expect(resumed.step).toBe('barber');
  });

  it('falls back to Anyone when the barber left the shop', () => {
    const draft = bookingDraft({ staffMemberId: 'barber-gone', step: 'when' });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.repairs).toEqual(['barber-cleared']);
    expect(resumed.draft.staffMemberId).toBeNull();
  });

  it('drops a day that has passed, keeping the services and the barber', () => {
    const draft = bookingDraft({
      staffMemberId: 'barber-a',
      date: '2026-09-19',
      time: '17:30',
      startsAtUtc: '2026-09-19T14:30:00Z',
      step: 'confirm',
    });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.repairs).toEqual(['date-cleared']);
    expect(resumed.draft.serviceIds).toEqual(['service-haircut']);
    expect(resumed.draft.staffMemberId).toBe('barber-a');
    expect(resumed.draft.date).toBeNull();
    expect(resumed.draft.time).toBeNull();
    expect(resumed.step).toBe('when');
  });

  it('drops a day past the shop horizon', () => {
    const draft = bookingDraft({ date: '2026-12-31', step: 'when' });

    const resumed = resumeDraft(draft, bookingOptions({ maxAdvanceDays: 30 }), TODAY);

    expect(resumed.repairs).toEqual(['date-cleared']);
    expect(resumed.draft.date).toBeNull();
  });

  it('keeps the last day inside the horizon', () => {
    const draft = bookingDraft({ date: '2026-10-20', step: 'when' });

    const resumed = resumeDraft(draft, bookingOptions({ maxAdvanceDays: 30 }), TODAY);

    expect(resumed.repairs).toEqual([]);
    expect(resumed.draft.date).toBe('2026-10-20');
  });

  it('drops a time with no instant behind it', () => {
    const draft = bookingDraft({ date: '2026-09-25', time: '17:30', startsAtUtc: null });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.repairs).toEqual(['time-cleared']);
    expect(resumed.draft.date).toBe('2026-09-25');
    expect(resumed.draft.time).toBeNull();
  });

  it('never lands on a step the draft had not reached', () => {
    const draft = bookingDraft({ serviceIds: ['service-haircut'], step: 'services' });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.step).toBe('services');
  });

  it('moves a confirm-step draft with no time back to the time step', () => {
    const draft = bookingDraft({ step: 'confirm' });

    const resumed = resumeDraft(draft, bookingOptions(), TODAY);

    expect(resumed.step).toBe('when');
  });
});

describe('applyDayCheck', () => {
  it('drops a day the shop no longer offers, and its time with it', () => {
    const draft = bookingDraft({
      date: '2026-09-25',
      time: '17:30',
      startsAtUtc: '2026-09-25T14:30:00Z',
      step: 'confirm',
    });

    const applied = applyDayCheck({ draft, repairs: [], step: 'confirm' }, ['2026-09-26']);

    expect(applied.repairs).toEqual(['date-cleared']);
    expect(applied.draft.date).toBeNull();
    expect(applied.draft.startsAtUtc).toBeNull();
    expect(applied.step).toBe('when');
  });

  it('leaves an offered day alone', () => {
    const draft = bookingDraft({ date: '2026-09-25', step: 'confirm' });
    const resume = { draft, repairs: [], step: 'confirm' as const };

    expect(applyDayCheck(resume, ['2026-09-25'])).toBe(resume);
  });
});

describe('applyTimeCheck', () => {
  it('drops the time and keeps the day', () => {
    const draft = bookingDraft({
      date: '2026-09-25',
      time: '17:30',
      startsAtUtc: '2026-09-25T14:30:00Z',
      step: 'confirm',
    });

    const applied = applyTimeCheck({ draft, repairs: [], step: 'confirm' }, ['18:00']);

    expect(applied.repairs).toEqual(['time-cleared']);
    expect(applied.draft.date).toBe('2026-09-25');
    expect(applied.draft.time).toBeNull();
    expect(applied.draft.startsAtUtc).toBeNull();
    expect(applied.step).toBe('when');
  });

  it('leaves a still-free time alone', () => {
    const draft = bookingDraft({ date: '2026-09-25', time: '17:30', step: 'confirm' });
    const resume = { draft, repairs: [], step: 'confirm' as const };

    expect(applyTimeCheck(resume, ['17:30', '18:00'])).toBe(resume);
  });
});
