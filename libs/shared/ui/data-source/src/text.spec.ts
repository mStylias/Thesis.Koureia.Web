import { foldText, foldValue } from './text';

describe('foldText', () => {
  it('folds Greek accents, which is how people type a search box', () => {
    expect(foldText('Αθήνα')).toBe(foldText('Αθηνα'));
    expect(foldText('Θεσσαλονίκη')).toBe('θεσσαλονικη');
  });

  it('folds Latin accents', () => {
    expect(foldText('Café')).toBe('cafe');
    expect(foldText('Ölçü')).toBe('olcu');
  });

  it('folds case as well, which the server`s bare LIKE does not', () => {
    expect(foldText('ΑΘΗΝΑ')).toBe(foldText('αθήνα'));
  });

  it('leaves unaccented text alone', () => {
    expect(foldText('roles')).toBe('roles');
    expect(foldText('')).toBe('');
  });
});

describe('foldValue', () => {
  it('folds the primitives a cell can hold', () => {
    expect(foldValue('Café')).toBe('cafe');
    expect(foldValue(42)).toBe('42');
    expect(foldValue(42n)).toBe('42');
    expect(foldValue(true)).toBe('true');
  });

  it('reports no text rather than an empty string', () => {
    // The distinction is load-bearing: an empty needle matches every string,
    // so a value with no text form has to fail the match, not pass it.
    expect(foldValue(null)).toBeNull();
    expect(foldValue(undefined)).toBeNull();
    expect(foldValue({ a: 1 })).toBeNull();
    expect(foldValue(new Date())).toBeNull();
  });
});
