/**
 * The glyph each filter operation shows on its chooser button.
 *
 * The chooser reports the operation in force. An `aria-label` alone does not:
 * a sighted user reading a row of identical funnels cannot tell "contains"
 * from "equals" without opening every menu.
 *
 * Presentational, so it lives beside the filter row rather than in `core/`,
 * which carries no framework or icon dependency.
 */
import {
  LucideAsterisk,
  LucideCircleSlash,
  LucideEqual,
  LucideEqualNot,
  LucideListChecks,
  LucideListX,
  type LucideIconData,
  type LucideIconInput,
} from '@lucide/angular';
import type { FilterOperator } from '../core/types/filter.types';

/**
 * Lucide carries no comparison operators and no substring glyphs, so this file
 * draws them on Lucide's own grid: 24 by 24, with the host `<svg>` supplying
 * `fill: none`, `stroke-width: 2` and round caps. A drawn glyph and a shipped
 * one then keep the same weight beside each other in one menu.
 *
 * Every glyph here was checked at 16 pixels, which is the size the chooser
 * draws. Shapes that read at 48 fill in at 16: a rounded rect narrower than
 * about 10 units becomes a blob, and two strokes closer than about 4 units
 * merge. That is why the substring family is a rule and a ring rather than
 * the obvious chip-inside-a-string.
 */
function path(d: string): LucideIconData['node'][number] {
  return ['path', { d }];
}

/** The rule the substring family marks. `M3 12h18` at 16px is 12 pixels. */
const RULE = path('M3 12h18');

/** The match, placed on {@link RULE} where the operation puts it. */
function marker(cx: number): LucideIconData['node'][number] {
  return ['circle', { cx: String(cx), cy: '12', r: '3.5' }];
}

function glyph(name: string, ...node: LucideIconData['node']): LucideIconData {
  return { name, node };
}

/** `<`. Wider and shallower than `LucideChevronLeft`, which means navigation. */
const lessThan = glyph('filter-less-than', path('M18 6 6 12l12 6'));

/** `>`. */
const greaterThan = glyph('filter-greater-than', path('M6 6l12 6-12 6'));

/** `≤`. The chevron rides high to leave the rule its own row. */
const lessOrEqual = glyph('filter-less-or-equal', path('M18 4 6 10l12 6'), path('M6 20h12'));

/** `≥`. */
const greaterOrEqual = glyph('filter-greater-or-equal', path('M6 4l12 6-12 6'), path('M6 20h12'));

/**
 * `|-|`: two bounds and the stretch they enclose. The bounds are short and the
 * link does not touch them — bars that run the full height with a line between
 * them draw a capital H instead.
 */
const span = glyph('filter-between', path('M5 8v8'), path('M19 8v8'), path('M9 12h6'));

/**
 * The four substring operations share one shape language: the rule is the
 * value, the ring is the text the user typed, and where the ring sits says
 * where the match must fall. Read as a set they teach themselves, which no
 * single icon for "ends with" can do.
 */
const contains = glyph('filter-contains', RULE, marker(12));
const notContains = glyph('filter-not-contains', RULE, marker(12), path('m4 20 16-16'));
const startsWith = glyph('filter-starts-with', RULE, marker(6));
const endsWith = glyph('filter-ends-with', RULE, marker(18));

/**
 * Icons the filter row draws, rendered through `LucideDynamicIcon`.
 *
 * `lt`/`le` and `gt`/`ge` are told apart by the rule under the chevron, the
 * way the printed operators are. `isNull` takes `∅` and `isNotNull` takes `*`,
 * which is the pair a user already reads as "nothing" against "anything".
 */
export const FILTER_OPERATION_ICONS: Readonly<Record<FilterOperator, LucideIconInput>> = {
  eq: LucideEqual,
  ne: LucideEqualNot,
  lt: lessThan,
  le: lessOrEqual,
  gt: greaterThan,
  ge: greaterOrEqual,
  between: span,
  contains,
  notContains,
  startsWith,
  endsWith,
  in: LucideListChecks,
  notIn: LucideListX,
  isNull: LucideCircleSlash,
  isNotNull: LucideAsterisk,
};

/** The glyph for an operation. The map covers every operator. */
export function filterOperationIcon(op: FilterOperator): LucideIconInput {
  return FILTER_OPERATION_ICONS[op];
}
