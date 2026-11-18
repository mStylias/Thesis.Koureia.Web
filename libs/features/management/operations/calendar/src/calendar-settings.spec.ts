import {
  DEFAULT_SETTINGS,
  isCalendarViewState,
  readSettings,
  viewStatesEqual,
} from './calendar-settings';

describe('readSettings', () => {
  it('reads a stored document', () => {
    const stored = {
      version: 1,
      view: 'month',
      timeScale: 10,
      dayColumns: 'perResource',
      showTime: true,
    };

    expect(readSettings(stored)).toEqual(stored);
  });

  it('falls back member by member, so one bad value keeps the rest', () => {
    expect(readSettings({ version: 1, view: 'month', timeScale: 15, panel: 'drawer' })).toEqual({
      ...DEFAULT_SETTINGS,
      view: 'month',
    });
  });

  // The open panel moved to the browser, so an older document's `panel` is left behind.
  it('ignores the panel an older document still carries', () => {
    expect(readSettings({ ...DEFAULT_SETTINGS, panel: 'filters' })).toEqual(DEFAULT_SETTINGS);
  });

  it('refuses a document of another version', () => {
    expect(readSettings({ version: 2, view: 'month' })).toBeNull();
    expect(readSettings('week')).toBeNull();
  });
});

describe('saved view state', () => {
  const state = {
    version: 1 as const,
    filters: { barberIds: ['b'], customerIds: [], statuses: ['pending'], categoryIds: [] },
    view: 'day' as const,
    timeScale: 10 as const,
    dayColumns: 'perResource' as const,
    showTime: true,
  };

  it('accepts a saved view of this page', () => {
    expect(isCalendarViewState(state)).toBe(true);
  });

  it('refuses another host’s state, or a view that is only part of an arrangement', () => {
    expect(isCalendarViewState({ version: 1, columns: [] })).toBe(false);
    expect(isCalendarViewState({ ...state, filters: { ...state.filters, statuses: [1] } })).toBe(
      false,
    );
    expect(isCalendarViewState({ version: 1, filters: state.filters })).toBe(false);
    expect(isCalendarViewState({ ...state, timeScale: 15 })).toBe(false);
  });

  it('counts the view and the settings as part of the arrangement', () => {
    expect(viewStatesEqual(state, { ...state })).toBe(true);
    expect(viewStatesEqual(state, { ...state, view: 'week' })).toBe(false);
    expect(viewStatesEqual(state, { ...state, showTime: false })).toBe(false);
  });
});
