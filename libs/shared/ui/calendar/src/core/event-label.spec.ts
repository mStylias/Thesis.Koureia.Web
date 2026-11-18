import type { CalendarBadge, CalendarResource } from '../calendar.types';
import { eventNameParts, eventNameSuffix } from './event-label';

const NIKOS: CalendarResource = { id: 'n', label: 'Νίκος Π.', swatch: 1 };
const PENDING: CalendarBadge = { label: 'Σε αναμονή', tone: 'warning' };

describe('eventNameParts', () => {
  it('names the resource with the host noun, then the badge', () => {
    expect(eventNameParts(NIKOS, PENDING, 'Κουρέας')).toEqual(['Κουρέας: Νίκος Π.', 'Σε αναμονή']);
  });

  it('names the resource alone when the host gives no noun', () => {
    expect(eventNameParts(NIKOS, undefined, '')).toEqual(['Νίκος Π.']);
  });

  it('reads the marks last', () => {
    expect(eventNameParts(NIKOS, PENDING, '', [{ icon: 'ban', label: 'Αποκλεισμένος' }])).toEqual([
      'Νίκος Π.',
      'Σε αναμονή',
      'Αποκλεισμένος',
    ]);
  });

  it('leaves out what the event does not have', () => {
    expect(eventNameParts(null, undefined, 'Κουρέας')).toEqual([]);
  });
});

describe('eventNameSuffix', () => {
  it('leads each part with a comma, so it follows the title', () => {
    expect(eventNameSuffix(NIKOS, PENDING, 'Κουρέας')).toBe(', Κουρέας: Νίκος Π., Σε αναμονή');
    expect(eventNameSuffix(null, undefined, '')).toBe('');
  });
});
