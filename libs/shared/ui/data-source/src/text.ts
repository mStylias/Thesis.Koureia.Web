/**
 * Text folding for local matching.
 *
 * Every local text comparison in the layer folds first — the global search,
 * the `contains` family of filter operators, and a control's own typeahead.
 * A transport binding folds the needle the same way and points it at a
 * normalized field, so a local result and a remote result answer one query
 * the same way.
 */

/** Combining marks left behind by NFD decomposition. */
const COMBINING_MARKS = /\p{M}/gu;

/**
 * Lowercases and strips diacritics, so `Αθηνα` matches `Αθήνα` and `Cafe`
 * matches `Café`.
 *
 * This is the client half of the server's `lower(unaccent(t))`. The two agree
 * on Latin and Greek accents, which is what the search boxes see. They are not
 * identical everywhere: `unaccent` is dictionary-driven and rewrites a few
 * characters that NFD does not decompose, `ß` and `Ø` among them. Do not build
 * an equality or a key on this function — it is for matching only.
 */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLocaleLowerCase();
}

/**
 * The folded text of a primitive, or `null` for a value that carries no text.
 *
 * `null` is not the empty string here: a value with no text form must fail a
 * `contains` rather than match every empty needle.
 */
export function foldValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    return foldText(value);
  }
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return foldText(String(value));
  }
  return null;
}
