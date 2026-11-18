import el from './el';
import en from './en';

/** Every key path of a dictionary, as `a.b.c`. */
function keys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) =>
    keys(value, prefix ? `${prefix}.${key}` : key),
  );
}

function texts(dictionary: object): string[] {
  return keys(dictionary)
    .map((path) =>
      path
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dictionary),
    )
    .filter((text): text is string => typeof text === 'string');
}

/** `σου`, the singular possessive, as a whole word. */
const SINGULAR_PRONOUN = /(?<!\p{L})σου(?!\p{L})/u;

/**
 * A sentence that starts with a word in an unstressed `-ε`, the ending of a singular imperative
 * (`Επίλεξε`, `Δοκίμασε`), or with `Δες`. Only the first word counts, because a past tense ends
 * the same way (`Ο κωδικός άλλαξε.`). The plural `-τε`, the first person `-με` and `κάθε` are
 * left out.
 */
const SINGULAR_IMPERATIVE = /(?:^|[.!;]\s+)(?:δες|\p{L}*[^τμθ\P{L}]ε)(?!\p{L})/iu;

describe('managementPageSections dictionaries', () => {
  it('has the same keys in Greek and English', () => {
    expect(keys(en).sort()).toEqual(keys(el).sort());
  });

  it('never addresses the reader with σου in Greek', () => {
    expect(texts(el).filter((text) => SINGULAR_PRONOUN.test(text))).toEqual([]);
  });

  it('never uses a singular imperative in Greek', () => {
    expect(texts(el).filter((text) => SINGULAR_IMPERATIVE.test(text))).toEqual([]);
  });

  it('catches the forms it guards against', () => {
    expect(SINGULAR_IMPERATIVE.test('Επίλεξε ώρα')).toBe(true);
    expect(SINGULAR_IMPERATIVE.test('Δοκίμασε ξανά.')).toBe(true);
    expect(SINGULAR_IMPERATIVE.test('Δες τον χάρτη')).toBe(true);
    expect(SINGULAR_IMPERATIVE.test('Το προφίλ αποθηκεύτηκε. Άλλαξε το.')).toBe(true);
    expect(SINGULAR_IMPERATIVE.test('Επιλέξτε ώρα')).toBe(false);
    expect(SINGULAR_IMPERATIVE.test('Ο κωδικός άλλαξε.')).toBe(false);
    expect(SINGULAR_PRONOUN.test('το email σου')).toBe(true);
    expect(SINGULAR_PRONOUN.test('το email σας')).toBe(false);
  });
});
