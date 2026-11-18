import { fitDrawerActions } from './drawer-actions-fit';

describe('fitDrawerActions', () => {
  // Three captioned actions of 100, icons of 40, gaps of 10 and an end slot of 80.
  const base = {
    gap: 10,
    end: 80,
    icon: 40,
    widths: [100, 100, 100],
    shrinkable: [true, true, true],
    menuRows: false,
  };

  it('keeps every caption when the line holds them', () => {
    // 300 + 80 + 3 gaps = 410.
    expect(fitDrawerActions({ ...base, available: 410 })).toEqual(['label', 'label', 'label']);
  });

  it('gives up the captions one at a time, from the end', () => {
    expect(fitDrawerActions({ ...base, available: 409 })).toEqual(['label', 'label', 'icon']);
    expect(fitDrawerActions({ ...base, available: 349 })).toEqual(['label', 'icon', 'icon']);
    expect(fitDrawerActions({ ...base, available: 289 })).toEqual(['icon', 'icon', 'icon']);
  });

  it('moves the icons into the menu from the end once every caption is gone', () => {
    // Three icons and the end take 230. Two icons, the ⋮ and the end take as much.
    expect(fitDrawerActions({ ...base, available: 229 })).toEqual(['icon', 'menu', 'menu']);
    expect(fitDrawerActions({ ...base, available: 179 })).toEqual(['menu', 'menu', 'menu']);
  });

  it('never gives a caption to an icon-only action', () => {
    expect(
      fitDrawerActions({
        ...base,
        available: 1000,
        widths: [100, 40],
        shrinkable: [true, false],
      }),
    ).toEqual(['label', 'icon']);
  });

  it('counts the ⋮ when the menu has rows of its own', () => {
    expect(fitDrawerActions({ ...base, available: 410, menuRows: true })).toEqual([
      'label',
      'label',
      'icon',
    ]);
  });

  it('keeps every caption before the toolbar is measured', () => {
    expect(fitDrawerActions({ ...base, available: 0 })).toEqual(['label', 'label', 'label']);
  });
});
