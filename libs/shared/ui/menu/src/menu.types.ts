import type { Params, UrlTree } from '@angular/router';
import type { LucideIconInput } from '@lucide/angular';

/**
 * Row height and text size of a menu surface. `compact` is for a menu that
 * answers one control — a column's options, a filter's operation — where the
 * standard command-list metrics dwarf the control they belong to.
 */
export type MenuDensity = 'standard' | 'compact';

/** Payload passed to a `MenuItem.command` callback. */
export interface MenuItemCommandEvent {
  /** The event that opened the menu, when one is available. */
  originalEvent?: Event;
  /** The activated item. */
  item: MenuItem;
}

/**
 * A single entry of a menu. Compared by reference, so use stable
 * object instances (a field initializer or a `computed()`).
 */
export interface MenuItem {
  /** Text of the item; also drives typeahead search. */
  readonly label?: string;

  /** Optional leading Lucide icon. */
  readonly icon?: LucideIconInput;

  /**
   * Optional trailing keyboard-shortcut hint (e.g. `⌘C`), rendered in
   * the mono typeface. Purely visual — binding the key is up to the
   * application.
   */
  readonly shortcut?: string;

  /** Focusable but not activatable, rendered dimmed. */
  readonly disabled?: boolean;

  /** An action that destroys data, such as Delete. The row is drawn in the error colour. */
  readonly danger?: boolean;

  /**
   * Marks the item as the choice in force: the row is highlighted and
   * reported as `menuitemradio` (or `menuitemcheckbox`, see
   * {@link checkedRole}) with `aria-checked`.
   *
   * Leave unset on an item that carries no state. Do not use `disabled` for
   * this — a screen reader announces that as unavailable, and the pattern
   * drops a disabled row out of typeahead.
   */
  readonly checked?: boolean;

  /**
   * What {@link checked} describes: one choice out of a set (`radio`, the
   * default) or an independent toggle (`checkbox`). Ignored without `checked`.
   */
  readonly checkedRole?: 'radio' | 'checkbox';

  /** Set to `false` to omit the item entirely. */
  readonly visible?: boolean;

  /** Renders a divider instead of an item; other fields are ignored. */
  readonly separator?: boolean;

  /**
   * Renders a non-interactive section heading (its `label`, optionally
   * with `icon`). Not focusable and never activated. It names a `group`
   * that holds the items up to the next heading, so a screen reader
   * announces it. Other interactive fields are ignored.
   */
  readonly heading?: boolean;

  /** Called when the item is activated (click, Enter, or Space). */
  readonly command?: (event: MenuItemCommandEvent) => void;

  /** Router commands, or a `UrlTree`, navigated to on activation. Commands resolve from the root. */
  readonly routerLink?: string | readonly unknown[] | UrlTree;

  /** Query parameters for `routerLink` commands. Ignored with a `UrlTree`. */
  readonly queryParams?: Params;

  /** External URL opened on activation (ignored with `routerLink`). */
  readonly url?: string;

  /** Window target for `url`, e.g. `_blank`. */
  readonly target?: string;

  /** Nested items — the item becomes a submenu trigger. */
  readonly items?: readonly MenuItem[];
}
