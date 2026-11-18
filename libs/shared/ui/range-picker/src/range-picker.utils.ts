import type { NumberRange } from './range-picker.types';

/** Returns finite, ordered domain bounds. */
export function normalizeDomain(domainMin: number, domainMax: number): NumberRange {
  const first = Number.isFinite(domainMin) ? domainMin : 0;
  const second = Number.isFinite(domainMax) ? domainMax : 100;
  return first <= second ? { start: first, end: second } : { start: second, end: first };
}

/** Returns a usable step for slider and field arithmetic. */
export function normalizeStep(step: number): number {
  return Number.isFinite(step) && step > 0 ? step : 1;
}

/** Clamps, snaps and orders a range for display. */
export function normalizeRange(value: NumberRange, domain: NumberRange, step = 1): NumberRange {
  const safeStep = normalizeStep(step);
  const rawStart = Number.isFinite(value.start) ? value.start : domain.start;
  const rawEnd = Number.isFinite(value.end) ? value.end : domain.end;
  const start = snapRangeValue(rawStart, domain, safeStep);
  const end = snapRangeValue(rawEnd, domain, safeStep);
  return start <= end ? { start, end } : { start: end, end: start };
}

/** Snaps a user value to the step grid inside the domain. */
export function snapRangeValue(value: number, domain: NumberRange, step: number): number {
  const clamped = clamp(value, domain.start, domain.end);
  const stepped = domain.start + Math.round((clamped - domain.start) / step) * step;
  const grid = clamp(Number(stepped.toFixed(10)), domain.start, domain.end);
  // The domain end stays reachable when the span is not a whole number of steps.
  return Math.abs(domain.end - clamped) < Math.abs(clamped - grid) ? domain.end : grid;
}

/**
 * Converts a domain value to its position as a `0`-`1` ratio.
 *
 * The ratio is unitless because the track offsets it by half a thumb at each
 * end, which needs `calc()` to mix it with a length.
 */
export function rangeRatio(value: number, domain: NumberRange): number {
  const span = domain.end - domain.start;
  return span === 0 ? 0 : (clamp(value, domain.start, domain.end) - domain.start) / span;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
