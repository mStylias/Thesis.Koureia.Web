/**
 * Toolbar composition and overflow (§13).
 *
 * Headless: descriptors in, draw entries out. The bar renders what this
 * produces and decides nothing itself, so the composition rules — which
 * built-in items exist, what a visibility predicate means, which entry
 * collapses first — are unit-tested without a view.
 */
import type { BuiltInToolbarItem, ToolbarItem } from './types/config.types';
import type {
  ToolbarLocation,
  ToolbarEntry,
  ImplementedToolbarItem,
  ToolbarHeadroomInput,
  ToolbarOverflowInput,
  ToolbarOverflowSplit,
} from './toolbar.types';

/** The built-in items this milestone implements, by name. */
export const IMPLEMENTED_TOOLBAR_ITEMS = [
  'columnChooser',
  'export',
  'refresh',
  'autoRefresh',
  'clearSelection',
  'resetArrangement',
  'search',
  'filterToggle',
  'groupPanel',
  'sortMenu',
  'viewSwitch',
  'filterBuilder',
  'views',
] as const satisfies readonly BuiltInToolbarItem[];

const IMPLEMENTED = new Set<string>(IMPLEMENTED_TOOLBAR_ITEMS);

/**
 * Which milestone ships a named item the grid cannot draw yet. Empty while
 * every name in {@link BuiltInToolbarItem} resolves; the lookup stays so a
 * later milestone's item is announced rather than silently dropped.
 */
const PENDING_TOOLBAR_ITEMS: Readonly<Record<string, string>> = {};

/** Whether the grid can draw a built-in item under this name. */
export function isImplementedToolbarItem(name: string): name is ImplementedToolbarItem {
  return IMPLEMENTED.has(name);
}

/**
 * The milestone that ships a named item the grid does not draw, or `null` when
 * the name is not a built-in at all. Drives the development warning: an item
 * that silently disappears is indistinguishable from a typo.
 */
export function pendingToolbarItemMilestone(name: string): string | null {
  return PENDING_TOOLBAR_ITEMS[name] ?? null;
}

/**
 * Whether a host item shows. The predicate is the host's own authorization
 * rule; the grid defines no authorization model of its own (§13).
 */
export function toolbarItemVisible(item: ToolbarItem): boolean {
  const visible = item.visible;
  if (visible == null) {
    return true;
  }
  return typeof visible === 'function' ? visible() : visible;
}

/**
 * Orders entries within one region: by `order`, then by declaration.
 *
 * A stable sort is not enough on its own — entries arrive from three places
 * (config, the templates map, directives) and only the caller knows the order
 * they were declared in, so it passes them already concatenated.
 */
export function sortToolbarEntries(entries: readonly ToolbarEntry[]): readonly ToolbarEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.order - b.entry.order || a.index - b.index)
    .map((held) => held.entry);
}

/** Entries of one region, in draw order. */
export function toolbarRegion(
  entries: readonly ToolbarEntry[],
  location: ToolbarLocation,
): readonly ToolbarEntry[] {
  return entries.filter((entry) => entry.location === location);
}

/**
 * Splits the entries between the bar and the overflow surface.
 *
 * Arithmetic over widths measured once per entry, not a layout read per
 * candidate: a collapsed entry leaves the bar and could not be re-measured
 * anyway, so the caller caches each width while its entry is inline.
 *
 * `never` entries are kept whatever the budget — an item the host declared
 * uncollapsible is uncollapsible, and a bar too narrow for it scrolls rather
 * than hiding it. The last `auto` entry in draw order collapses first, so the
 * bar loses its trailing items rather than the ones it opens with.
 */
export function splitToolbarOverflow(input: ToolbarOverflowInput): ToolbarOverflowSplit {
  const always = input.entries.filter((entry) => entry.overflow === 'always');
  const collapsible = input.entries.filter((entry) => entry.overflow === 'auto');
  const fixed = input.entries.filter((entry) => entry.overflow === 'never');
  const widthOf = (id: string): number => input.widths.get(id) ?? 0;
  const sum = (entries: readonly { id: string }[]): number =>
    entries.reduce((total, entry) => total + widthOf(entry.id), 0);

  // Before the first measurement everything stays in the bar: a bar that
  // collapses on width zero would open every grid with one overflow button and
  // expand a frame later, which reads as a fault.
  if (input.available <= 0) {
    return { inline: input.entries.map((entry) => entry.id), collapsed: [] };
  }

  const collapsed = new Set(always.map((entry) => entry.id));
  const budget = collapsed.size > 0 ? input.available - input.triggerWidth : input.available;
  let used = sum(fixed) + sum(collapsible);

  if (used > budget) {
    // The trigger is about to appear, so it takes its width off the budget
    // even when only `auto` entries collapse.
    const withTrigger = input.available - input.triggerWidth;
    for (let index = collapsible.length - 1; index >= 0 && used > withTrigger; index -= 1) {
      const entry = collapsible[index];
      collapsed.add(entry.id);
      used -= widthOf(entry.id);
    }
  }

  return {
    inline: input.entries.filter((entry) => !collapsed.has(entry.id)).map((entry) => entry.id),
    collapsed: input.entries.filter((entry) => collapsed.has(entry.id)).map((entry) => entry.id),
  };
}

/**
 * Width the bar has left once every rigid entry has taken its own.
 *
 * The number an elastic entry reads to decide which of its own presentations
 * it can afford. The overflow trigger's width comes off whether or not the
 * trigger is drawn, which is what makes the answer arrive *before* the bar
 * starts collapsing rather than with the first item that goes.
 *
 * Elastic entries are excluded on purpose — see {@link ToolbarEntry.elastic}.
 * Before the first measurement the bar has no width to report, and a zero
 * headroom would put every elastic entry into its smallest form for one
 * frame, so the answer is unbounded until there is something to measure.
 */
export function toolbarHeadroom(input: ToolbarHeadroomInput): number {
  if (input.available <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const used = input.entries.reduce(
    (total, entry) => (entry.elastic ? total : total + (input.widths.get(entry.id) ?? 0)),
    0,
  );
  return input.available - used - input.triggerWidth;
}
