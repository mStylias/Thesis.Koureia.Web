import { convertToParamMap } from '@angular/router';

import { positionParams, readPosition } from './calendar-url';

describe('readPosition', () => {
  it('reads the view, the date and per-barber columns', () => {
    const params = convertToParamMap({ view: 'day', date: '2026-09-21', columns: 'barbers' });

    expect(readPosition(params)).toEqual({
      view: 'day',
      anchor: '2026-09-21',
      dayColumns: 'perResource',
    });
  });

  it('reads day view without columns as one column', () => {
    expect(readPosition(convertToParamMap({ view: 'day' })).dayColumns).toBe('single');
  });

  it('leaves the column mode to the settings outside day view', () => {
    expect(readPosition(convertToParamMap({ view: 'week' }))).toEqual({ view: 'week' });
  });

  it('ignores a malformed view or date, so the persisted value fills it', () => {
    expect(readPosition(convertToParamMap({ view: 'decade', date: '21/09/2026' }))).toEqual({});
  });
});

describe('positionParams', () => {
  it('writes columns in day view only', () => {
    expect(
      positionParams({ view: 'day', anchor: '2026-09-21', dayColumns: 'perResource' }),
    ).toEqual({ view: 'day', date: '2026-09-21', columns: 'barbers' });
    expect(
      positionParams({ view: 'week', anchor: '2026-09-21', dayColumns: 'perResource' }),
    ).toEqual({ view: 'week', date: '2026-09-21' });
  });

  it('leaves today out of the address', () => {
    expect(positionParams({ view: 'month', anchor: '', dayColumns: 'single' })).toEqual({
      view: 'month',
    });
  });
});
