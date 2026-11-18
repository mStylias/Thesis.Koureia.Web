/** Below this the distance reads in metres; at or above it, in kilometres. */
const KILOMETRE = 1000;

/** Metres are rounded to this, because the origin is a city centre, not the person. */
const METRE_STEP = 10;

/**
 * A distance in metres, written the way the reader's locale writes it.
 *
 * `Intl` supplies the unit, so Greek gets `μ.` and `χλμ.` with no translation key, and the
 * decimal separator follows the locale rather than the source.
 */
export function formatDistance(meters: number, locale: string): string {
  if (!Number.isFinite(meters) || meters < 0) return '';

  if (meters < KILOMETRE) {
    const rounded = Math.round(meters / METRE_STEP) * METRE_STEP;
    return format(rounded, locale, 'meter', 0);
  }

  return format(meters / KILOMETRE, locale, 'kilometer', 1);
}

function format(value: number, locale: string, unit: string, fractionDigits: number): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
