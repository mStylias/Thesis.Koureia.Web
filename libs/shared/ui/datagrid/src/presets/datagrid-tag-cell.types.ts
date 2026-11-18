import type { TagTone } from './preset.types';

/** One drawn tag. */
export interface RenderedTag {
  label: string;
  tone: TagTone;
  tooltip: string;
}

/**
 * What a tag costs besides its text, read once from a rendered tag cell. All lengths are in CSS
 * pixels and cover both sides.
 */
export interface TagMetrics {
  /** The canvas `font` of a tag's text. */
  readonly font: string;
  /** The tag's `letter-spacing`, as canvas `letterSpacing` takes it. */
  readonly letterSpacing: string;
  /** The tag's inline padding. */
  readonly tagPadding: number;
  /** The gap between two tags. */
  readonly gap: number;
  /** The cell's inline padding and borders, which the column width includes. */
  readonly cellPadding: number;
}
