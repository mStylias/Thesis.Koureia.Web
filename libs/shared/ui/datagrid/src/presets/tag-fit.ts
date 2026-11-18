import type { TagMetrics } from './datagrid-tag-cell.types';

/** Entries kept before the width cache starts over. Labels are short and repeat across rows. */
const TEXT_CACHE_LIMIT = 2000;

/** Rounding between canvas text and laid-out text, so a tag that just fits is not ellipsed. */
const TAG_SLACK = 1;

const textWidths = new Map<string, number>();
let context: CanvasRenderingContext2D | null | undefined;

/**
 * How many tags a cell shows, in order, before the rest collapse into one `+n` tag.
 *
 * Every tag shows when all of them fit. Otherwise the count is the most that fit beside the `+n`
 * tag, and never less than one: the first tag then shrinks and ellipses rather than leaving a cell
 * that says only "+3".
 */
export function fitTagCount(
  widths: readonly number[],
  available: number,
  gap: number,
  moreWidth: (hidden: number) => number,
): number {
  const count = widths.length;
  const all = widths.reduce((total, width) => total + width, 0) + gap * Math.max(0, count - 1);
  if (all <= available) return count;

  let used = 0;
  let shown = 0;
  for (const width of widths) {
    const next = used + (shown > 0 ? gap : 0) + width;
    const hidden = count - shown - 1;
    const needed = hidden > 0 ? next + gap + moreWidth(hidden) : next;
    if (needed > available) break;
    used = next;
    shown++;
  }
  return Math.max(1, shown);
}

/**
 * The drawn width of one tag with `label` in it, text plus padding. `null` without a canvas.
 * `fontsVersion` is part of the cache key: text measured in a fallback face is stale once the web
 * font lands.
 */
export function tagWidth(
  label: string,
  metrics: TagMetrics,
  document: Document,
  fontsVersion: number,
): number | null {
  const text = textWidth(label, metrics, document, fontsVersion);
  return text === null ? null : Math.ceil(text) + metrics.tagPadding + TAG_SLACK;
}

function textWidth(
  label: string,
  metrics: TagMetrics,
  document: Document,
  fontsVersion: number,
): number | null {
  const key = `${fontsVersion.toString()}|${metrics.font}|${metrics.letterSpacing}|${label}`;
  const cached = textWidths.get(key);
  if (cached !== undefined) return cached;

  context ??= document.createElement('canvas').getContext('2d');
  if (context === null) return null;
  context.font = metrics.font;
  context.letterSpacing = metrics.letterSpacing === 'normal' ? '0px' : metrics.letterSpacing;
  const width = context.measureText(label).width;

  if (textWidths.size >= TEXT_CACHE_LIMIT) textWidths.clear();
  textWidths.set(key, width);
  return width;
}

/** Reads a tag cell's metrics from one of its rendered tags. Style reads only, no layout. */
export function readTagMetrics(tag: HTMLElement, host: HTMLElement, cell: HTMLElement): TagMetrics {
  const view = tag.ownerDocument.defaultView;
  if (view === null) throw new Error('tag cell: no window to read styles from');
  const tagStyle = view.getComputedStyle(tag);
  const cellStyle = view.getComputedStyle(cell);
  return {
    font: [tagStyle.fontStyle, tagStyle.fontWeight, tagStyle.fontSize, tagStyle.fontFamily].join(
      ' ',
    ),
    letterSpacing: tagStyle.letterSpacing,
    tagPadding: px(tagStyle.paddingLeft) + px(tagStyle.paddingRight),
    gap: px(view.getComputedStyle(host).columnGap),
    cellPadding:
      px(cellStyle.paddingLeft) +
      px(cellStyle.paddingRight) +
      px(cellStyle.borderLeftWidth) +
      px(cellStyle.borderRightWidth),
  };
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
