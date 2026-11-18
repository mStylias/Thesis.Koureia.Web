import { CAPABILITY_OF_ALLOW, GRID_CAPABILITIES, resolveCapabilities } from './capabilities';

describe('resolveCapabilities', () => {
  it('permits everything when nothing is declared', () => {
    const mask = resolveCapabilities(null);
    expect(GRID_CAPABILITIES.every((capability) => mask[capability])).toBe(true);
  });

  it('withholds one capability and leaves the rest alone', () => {
    const mask = resolveCapabilities({ filtering: false });
    expect(mask.filtering).toBe(false);
    expect(mask.sorting).toBe(true);
    expect(mask.selection).toBe(true);
  });

  it('withholds every capability under readOnly', () => {
    const mask = resolveCapabilities({ readOnly: true });
    expect(GRID_CAPABILITIES.some((capability) => mask[capability])).toBe(false);
  });

  it('re-grants selectively on top of readOnly — the locked view that still sorts', () => {
    const mask = resolveCapabilities({ readOnly: true, sorting: true, paging: true });
    expect(mask.sorting).toBe(true);
    expect(mask.paging).toBe(true);
    expect(mask.filtering).toBe(false);
    expect(mask.hiding).toBe(false);
    expect(mask.stateChange).toBe(false);
  });

  it('answers every capability, so no caller has to treat absent as permitted', () => {
    const mask = resolveCapabilities({ sorting: false });
    for (const capability of GRID_CAPABILITIES) {
      expect(typeof mask[capability]).toBe('boolean');
    }
  });

  it('pairs a header filter permission with the filtering capability', () => {
    expect(CAPABILITY_OF_ALLOW.headerFiltering).toBe('filtering');
    expect(CAPABILITY_OF_ALLOW.filtering).toBe('filtering');
  });
});
