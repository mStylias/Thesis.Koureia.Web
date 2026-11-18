import { formatWhen, jobTitleLabel, roleLabel } from './staff.format';

const COPY: Readonly<Record<string, string>> = {
  'managementStaff.when.today': 'today {{ time }}',
  'managementStaff.when.tomorrow': 'tomorrow {{ time }}',
  'managementStaff.roleNames.staff': 'Staff member',
  'managementStaff.jobTitles.barber': 'Barber',
  'managementStaff.jobTitles.none': 'No job title',
};

/** Answers the key itself when it has no copy, as Transloco does. */
function translate(key: string, params?: Record<string, unknown>): string {
  const text = COPY[key] ?? key;
  return text.replace(/\{\{ (\w+) \}\}/g, (_, name: string) => {
    const value = params?.[name];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  });
}

describe('staff formatting', () => {
  // 21:30 UTC on 4 Oct is 00:30 on 5 Oct in Athens.
  const now = new Date('2026-10-04T21:30:00Z');

  it('says today and tomorrow in the shop zone', () => {
    expect(formatWhen('2026-10-05T08:30:00Z', 'Europe/Athens', now, 'en', translate)).toBe(
      'today 11:30',
    );
    expect(formatWhen('2026-10-06T08:30:00Z', 'Europe/Athens', now, 'en', translate)).toBe(
      'tomorrow 11:30',
    );
  });

  it('names a later day by its date', () => {
    expect(formatWhen('2026-10-09T08:30:00Z', 'Europe/Athens', now, 'en', translate)).toBe(
      'Oct 9, 11:30',
    );
  });

  it('translates a system role and keeps a shop role as it was named', () => {
    expect(roleLabel('staff', true, translate)).toBe('Staff member');
    expect(roleLabel('Senior barber', false, translate)).toBe('Senior barber');
    expect(roleLabel('unknown_system', true, translate)).toBe('unknown_system');
  });

  it('labels a job title, none, and an unknown code', () => {
    expect(jobTitleLabel('barber', translate)).toBe('Barber');
    expect(jobTitleLabel(null, translate)).toBe('No job title');
    expect(jobTitleLabel('colourist', translate)).toBe('colourist');
  });
});
