import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps a path on this origin, query and all', () => {
    expect(safeReturnUrl('/el/barbershops?near=me', 'el')).toBe('/el/barbershops?near=me');
  });

  it.each([
    ['a protocol-relative URL', '//attacker.example/el'],
    ['an absolute URL', 'https://attacker.example/el'],
    ['a bare path', 'el/barbershops'],
    ['a backslash separator', '/el\\attacker.example'],
    ['a NUL byte', '/el/barbershops\0'],
    ['nothing at all', null],
    ['a value that is not a string', 42],
  ])('falls back to the language home for %s', (_name, value) => {
    expect(safeReturnUrl(value, 'el')).toBe('/el');
  });

  it('falls back in the language of the page it is on', () => {
    expect(safeReturnUrl(null, 'en')).toBe('/en');
  });
});
