import type { TemplateRef } from '@angular/core';
import type { LucideIconInput } from '@lucide/angular';
import type { IMPLEMENTED_TOOLBAR_ITEMS } from './toolbar';

/** Region of the bar an entry belongs to. */
export type ToolbarLocation = 'start' | 'center' | 'end';

/** Whether an entry may collapse into the overflow surface. */
export type ToolbarOverflowPolicy = 'always' | 'never' | 'auto';

/** Visual weight of a host item, mapped to the button's own vocabulary. */
export type ToolbarItemVariant = 'primary' | 'secondary' | 'ghost';

/** What the bar draws for one entry. */
export type ToolbarEntryKind =
  | 'button'
  /** A trigger opening a menu of sub-items, with no action of its own. */
  | 'menu'
  /** A primary action plus a menu of related ones. */
  | 'split'
  | 'template'
  | 'component'
  /** The column chooser, which owns its own trigger and panel. */
  | 'columnChooser'
  /** The search field, which is an editor rather than a control. */
  | 'search';

/**
 * One sub-item of a menu or split entry.
 *
 * A built-in item carries a message key rather than a translated string:
 * `TranslocoService.translate` answers with the key until the lazy scope
 * loads, and an entry built on the first paint would ship
 * `datagrid.refresh.now` into the menu. The bar translates at open time, which
 * is a user action and therefore safe.
 */
export interface ToolbarSubItem {
  readonly id: string;
  /** A host-supplied label. Empty when {@link labelKey} names one. */
  readonly label: string;
  /** A message key, resolved when the menu opens. Empty for a host item. */
  readonly labelKey: string;
  readonly labelParams: Readonly<Record<string, unknown>> | null;
  readonly icon: LucideIconInput | null;
  readonly disabled: boolean;
  /** Marks the choice in force. `null` on an item that carries no state. */
  readonly checked: boolean | null;
  readonly command: () => void;
}

/** A component rendered as a toolbar item, with the inputs it takes. */
export interface ToolbarComponentRenderer {
  readonly type: unknown;
  readonly inputs: Readonly<Record<string, unknown>>;
}

/**
 * One entry, resolved and ready to draw.
 *
 * Built-in items and host items collapse to the same shape here: the grid
 * turns a name into label, icon and command before the bar sees it, so the bar
 * holds no knowledge of the grid's own actions.
 */
export interface ToolbarEntry {
  readonly id: string;
  readonly location: ToolbarLocation;
  readonly order: number;
  readonly overflow: ToolbarOverflowPolicy;
  /**
   * The entry adapts to the room it is given rather than claiming a width of
   * its own, so it is left out of the bar's headroom sum.
   *
   * Counting it would make the sum depend on the answer: an entry that shrinks
   * when the bar runs short frees the width that said it had to shrink, and
   * the two swap back and forth every frame.
   */
  readonly elastic: boolean;
  readonly kind: ToolbarEntryKind;
  /** A host-supplied caption. Empty when {@link labelKey} names one. */
  readonly label: string;
  /** A message key the bar pipes. Empty for a host item, which owns its text. */
  readonly labelKey: string;
  /**
   * A shorter caption for the overflow surface, where a row states what it
   * does beside its neighbours rather than alone in a bar. Empty keeps
   * {@link label} / {@link labelKey} everywhere.
   */
  readonly shortLabel: string;
  /** The message key of {@link shortLabel}. Empty for a host item. */
  readonly shortLabelKey: string;
  /** Repeats a clipped caption. Empty means no tooltip. */
  readonly tooltip: string;
  readonly icon: LucideIconInput | null;
  readonly variant: ToolbarItemVariant;
  /** Draw the icon alone and carry {@link label} into the accessible name. */
  readonly iconOnly: boolean;
  /**
   * The action this entry started is running. The bar spins the icon and marks
   * the button `aria-busy`, which is the feedback for a command whose result
   * the user cannot otherwise see.
   */
  readonly busy: boolean;
  readonly disabled: boolean;
  /** A count drawn beside the caption. Empty means none. */
  readonly badge: string;
  /**
   * What the entry does. It takes the press, because an entry that opens an
   * overlay has to anchor it on the button the user actually pressed — the
   * same reason the menu entries are handed their event. Every other command
   * ignores it.
   */
  readonly command: ((event: MouseEvent) => void) | null;
  readonly items: readonly ToolbarSubItem[];
  readonly template: TemplateRef<unknown> | null;
  readonly component: ToolbarComponentRenderer | null;
}

/** A built-in name the grid can resolve. */
export type ImplementedToolbarItem = (typeof IMPLEMENTED_TOOLBAR_ITEMS)[number];

/** What {@link splitToolbarOverflow} is given. */
export interface ToolbarOverflowInput {
  /** Every entry, in draw order across the three regions. */
  readonly entries: readonly Pick<ToolbarEntry, 'id' | 'overflow'>[];
  /** Measured outer width of each entry, including the gap that follows it. */
  readonly widths: ReadonlyMap<string, number>;
  /** Width the bar has for entries. Zero or less means "not measured yet". */
  readonly available: number;
  /** Width the overflow trigger claims once it is drawn. */
  readonly triggerWidth: number;
}

/** What {@link toolbarHeadroom} is given. */
export interface ToolbarHeadroomInput {
  /** Every entry, elastic ones included — they are filtered out here. */
  readonly entries: readonly Pick<ToolbarEntry, 'id' | 'elastic'>[];
  /** Measured outer width of each entry, including the gap that follows it. */
  readonly widths: ReadonlyMap<string, number>;
  /** Width the bar has for entries. Zero or less means "not measured yet". */
  readonly available: number;
  /** Width the overflow trigger claims once it is drawn. */
  readonly triggerWidth: number;
}

/** Which entries stay in the bar and which move into the overflow surface. */
export interface ToolbarOverflowSplit {
  readonly inline: readonly string[];
  readonly collapsed: readonly string[];
}
