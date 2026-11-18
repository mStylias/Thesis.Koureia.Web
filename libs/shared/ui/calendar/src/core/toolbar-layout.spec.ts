import { CALENDAR_TOOLBAR_BREAKPOINTS, VIEWS_BUDGET, toolbarLayout } from './toolbar-layout';

describe('toolbarLayout', () => {
  it('draws everything inline on a wide host, with no menu', () => {
    expect(toolbarLayout(1800)).toEqual({
      todayLabel: true,
      dateInline: true,
      views: 'strip',
      filtersInline: true,
      settingsInline: true,
      refreshInline: true,
      viewSwitch: 'buttons',
      createInline: true,
      floating: false,
      menu: false,
      compactRange: false,
      panelOverlay: false,
    });
  });

  it('folds from the right, one control per threshold', () => {
    const b = CALENDAR_TOOLBAR_BREAKPOINTS;

    expect(toolbarLayout(b.viewButtons - 1).viewSwitch).toBe('select');
    expect(toolbarLayout(b.viewSelect - 1).viewSwitch).toBe('menu');
    expect(toolbarLayout(b.refresh - 1).refreshInline).toBe(false);
    expect(toolbarLayout(b.settings - 1).settingsInline).toBe(false);
    expect(toolbarLayout(b.filters - 1).filtersInline).toBe(false);
    expect(toolbarLayout(b.viewsCompact - 1).views).toBe('compact');
    expect(toolbarLayout(b.viewsMenu - 1).views).toBe('menu');
    expect(toolbarLayout(b.date - 1).dateInline).toBe(false);
    expect(toolbarLayout(b.todayLabel - 1).todayLabel).toBe(false);
    expect(toolbarLayout(b.create - 1).createInline).toBe(false);
  });

  it('shows the menu button as soon as the first control folds', () => {
    expect(toolbarLayout(CALENDAR_TOOLBAR_BREAKPOINTS.viewButtons).menu).toBe(false);
    expect(toolbarLayout(CALENDAR_TOOLBAR_BREAKPOINTS.viewSelect - 1).menu).toBe(true);
  });

  it('floats Create and the view switch where Create folds', () => {
    const b = CALENDAR_TOOLBAR_BREAKPOINTS;
    expect(toolbarLayout(b.create).floating).toBe(false);
    expect(toolbarLayout(b.create - 1)).toMatchObject({
      floating: true,
      createInline: false,
      viewSwitch: 'menu',
      // The date field is still folded, so the overflow panel stays.
      menu: true,
    });
  });

  it('folds in one fixed order, each threshold below the one before', () => {
    const order = Object.values(CALENDAR_TOOLBAR_BREAKPOINTS);
    expect([...order].sort((a, b) => b - a)).toEqual(order);
  });

  it('gives the views budget back to the controls that fold before the views', () => {
    const b = CALENDAR_TOOLBAR_BREAKPOINTS;
    const width = b.filters - 1;
    expect(toolbarLayout(width).filtersInline).toBe(false);
    expect(toolbarLayout(width, { views: false }).filtersInline).toBe(true);
    expect(toolbarLayout(b.viewButtons - VIEWS_BUDGET, { views: false }).viewSwitch).toBe(
      'buttons',
    );
    expect(toolbarLayout(b.date, { views: false }).views).toBe('menu');
  });

  it('keeps the panel pushing until the host is narrow, then overlays it', () => {
    expect(toolbarLayout(960).panelOverlay).toBe(false);
    expect(toolbarLayout(959).panelOverlay).toBe(true);
  });

  it('lets the range label wrap on a narrow host', () => {
    expect(toolbarLayout(640).compactRange).toBe(false);
    expect(toolbarLayout(639).compactRange).toBe(true);
  });
});
