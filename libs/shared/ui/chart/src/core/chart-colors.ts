import type { ChartTokens } from '../chart-theme.types';

/**
 * Swatch `index` (from 0), repeating after the sixth. A repeated swatch needs its label to tell
 * it apart. Falls back to the accent when the theme gives no swatch.
 *
 * ```ts
 * series.map((item, index) => ({ ...item, color: chartSwatch(tokens, index) }));
 * ```
 */
export function chartSwatch(tokens: ChartTokens, index: number): string {
  const count = tokens.swatches.length;
  if (count === 0 || !Number.isFinite(index)) {
    return tokens.accent;
  }
  const slot = ((Math.trunc(index) % count) + count) % count;
  return tokens.swatches[slot] ?? tokens.accent;
}

/**
 * The text color for a label set inside a fill: `textPrimary` or `surface`, whichever has more
 * contrast on `fill`. Both themes have one light and one dark of the pair.
 *
 * Returns `textPrimary` when `fill` is not a hex or `rgb()` color.
 */
export function chartInkOn(tokens: ChartTokens, fill: string): string {
  const ground = luminance(fill);
  const primary = luminance(tokens.textPrimary);
  const surface = luminance(tokens.surface);
  if (ground === null || primary === null || surface === null) {
    return tokens.textPrimary;
  }
  return contrast(ground, surface) > contrast(ground, primary)
    ? tokens.surface
    : tokens.textPrimary;
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG relative luminance of a hex or `rgb()` color, or `null` when it cannot parse. */
function luminance(color: string): number | null {
  const channels = parseColor(color.trim());
  if (!channels) {
    return null;
  }
  const [r, g, b] = channels.map((value) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex;
    return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(color);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}
