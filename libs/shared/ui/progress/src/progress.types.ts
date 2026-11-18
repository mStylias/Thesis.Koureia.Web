/**
 * Shared vocabulary for the progress indicators (`lib-progress-bar` and
 * `lib-progress-spinner`). Both consume the same tone/size scales and the
 * same value-normalization rule, so they stay visually and behaviourally
 * consistent.
 */

/**
 * Emphasis colour. `accent` is the brand house colour; the rest map to the
 * design system's muted semantic hues for status-carrying progress (e.g. a
 * failing upload turns `error`). No arbitrary colours by design — one accent.
 */
export type ProgressTone = 'accent' | 'success' | 'warning' | 'error' | 'info';

/** Size on the shared control scale. */
export type ProgressSize = 'sm' | 'md' | 'lg';

/**
 * `determinate` tracks a known 0–100 value; `indeterminate` animates without
 * a value for work of unknown duration.
 */
export type ProgressMode = 'determinate' | 'indeterminate';

/**
 * Indeterminate spinner motion. `linear` is a steady constant-speed arc;
 * `ease` is the Material-style organic spin where the arc grows, shrinks, and
 * changes pace as it turns (non-linear feel).
 */
export type ProgressSpin = 'linear' | 'ease';

/** Clamp a raw value into the `[0, 100]` percentage range. */
export const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
