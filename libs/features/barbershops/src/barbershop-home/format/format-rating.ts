/** A rating average with one decimal, in the reader's locale: `4,7` in Greek, `4.7` in English. */
export function formatRating(average: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
}

/**
 * The dictionary branch for a count: `one` or `other`. Both app languages need only those two,
 * and any other category the locale reports falls back to `other`.
 */
export function pluralBranch(count: number, locale: string): 'one' | 'other' {
  return new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other';
}
