import type { AppLanguage } from '@util/language';

/**
 * How each language names the units. Greek spells them out (`1 ώρα 15 λεπτά`), which is how a
 * price list reads. English abbreviates (`1 hr 15 min`), which is how a menu reads.
 */
const UNIT_DISPLAY: Record<AppLanguage, 'long' | 'short'> = { el: 'long', en: 'short' };

const MINUTES_PER_HOUR = 60;

/**
 * A service's length in hours and minutes. `Intl` supplies the units and their plurals, so no
 * translation key is involved.
 */
export function formatDuration(minutes: number, language: AppLanguage): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';

  const whole = Math.round(minutes);
  const hours = Math.floor(whole / MINUTES_PER_HOUR);
  const rest = whole % MINUTES_PER_HOUR;
  const parts: string[] = [];

  if (hours > 0) parts.push(format(hours, 'hour', language));
  if (rest > 0) parts.push(format(rest, 'minute', language));
  return parts.join(' ');
}

function format(value: number, unit: 'hour' | 'minute', language: AppLanguage): string {
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit,
    unitDisplay: UNIT_DISPLAY[language],
  }).format(value);
}
