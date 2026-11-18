import { keepsPlace } from './drawer-handoff';
import type { DrawerToolbarMark } from './drawer-handoff.types';

describe('keepsPlace', () => {
  const edit: DrawerToolbarMark = { label: 'Edit', left: 700, width: 96 };

  it('keeps a button drawn the same in the same place', () => {
    expect(keepsPlace({ label: 'Edit', left: 700, width: 96 }, [edit])).toBe(true);
  });

  it('forgives a pixel of rounding', () => {
    expect(keepsPlace({ label: 'Edit', left: 701, width: 95 }, [edit])).toBe(true);
  });

  it('moves a button with another label in the same place', () => {
    expect(keepsPlace({ label: 'Save', left: 700, width: 96 }, [edit])).toBe(false);
  });

  it('moves a button that moved or changed size', () => {
    expect(keepsPlace({ label: 'Edit', left: 640, width: 96 }, [edit])).toBe(false);
    expect(keepsPlace({ label: 'Edit', left: 700, width: 40 }, [edit])).toBe(false);
  });
});
