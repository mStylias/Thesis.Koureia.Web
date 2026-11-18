import el from './el';
import en from './en';

/** Every key path of a dictionary, as `a.b.c`. */
function keys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) =>
    keys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe('managementDashboard dictionaries', () => {
  it('has the same keys in Greek and English', () => {
    expect(keys(en).sort()).toEqual(keys(el).sort());
  });

  it('never addresses the reader in the singular in Greek', () => {
    const singular = keys(el)
      .map((path) =>
        path
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], el),
      )
      .filter((text): text is string => typeof text === 'string')
      .filter((text) => /\bσου\b/.test(text));
    expect(singular).toEqual([]);
  });
});
