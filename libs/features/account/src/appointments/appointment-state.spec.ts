import { appointment } from '../account.fixture';
import { appointmentActions, statusChip, telHref } from './appointment-state';

const NOW = Date.parse('2099-09-25T13:00:00Z');

describe('appointmentActions', () => {
  it('offers change and cancel while the server says it can change', () => {
    expect(appointmentActions(appointment({ canChange: true }), NOW)).toBe('change');
  });

  it('offers the shop phone for an upcoming appointment inside the cutoff', () => {
    expect(appointmentActions(appointment({ canChange: false }), NOW)).toBe('call');
  });

  it('does not offer the phone for an active appointment whose time has passed', () => {
    const late = Date.parse('2099-09-25T16:00:00Z');
    expect(appointmentActions(appointment({ canChange: false }), late)).toBe('past');
  });

  it('offers a review when the server says the visit can be reviewed', () => {
    const completed = appointment({ status: 'completed', canChange: false, canReview: true });
    expect(appointmentActions(completed, NOW)).toBe('review');
  });

  it('offers only book again for a cancelled appointment', () => {
    const cancelled = appointment({ status: 'cancelled', canChange: false, cancelledBy: 'Shop' });
    expect(appointmentActions(cancelled, NOW)).toBe('past');
  });
});

describe('statusChip', () => {
  it('labels a known status with its own key', () => {
    expect(statusChip('confirmed')).toEqual({
      labelKey: 'account.status.confirmed',
      tone: 'success',
    });
  });

  it('reads a status it does not know as unknown, never as a raw key', () => {
    expect(statusChip('archived')).toEqual({ labelKey: 'account.status.unknown', tone: 'neutral' });
  });
});

describe('telHref', () => {
  it('keeps only the digits and the plus sign', () => {
    expect(telHref('+30 210 123-4567')).toBe('tel:+302101234567');
  });
});
