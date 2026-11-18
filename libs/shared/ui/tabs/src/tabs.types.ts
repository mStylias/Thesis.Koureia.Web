/** Layout axis of a tab list. Mirrors `@angular/aria` orientation. */
export type TabsOrientation = 'horizontal' | 'vertical';

/**
 * How focus translates into selection.
 * - `follow` (automatic activation): moving focus with the arrow keys
 *   selects the focused tab immediately — best when panels are cheap.
 * - `explicit` (manual activation): arrow keys only move focus; the user
 *   commits with Enter/Space — best when a panel is expensive or lazy.
 */
export type TabsSelectionMode = 'follow' | 'explicit';

/**
 * A single entry in a router-driven `lib-tab-menu`. Tab menus navigate
 * instead of toggling panels, so each item is a link.
 *
 * Tracked by reference, so use stable object instances (a field
 * initializer or a `computed()`) — two items may share a `label`.
 */
export interface TabMenuItem {
  /** Visible label. */
  readonly label: string;
  /**
   * Router command(s) passed straight to `routerLink`. Use this for
   * in-app navigation so the active tab tracks the URL.
   */
  readonly routerLink?: string | readonly unknown[];
  /** Absolute/external URL rendered as a plain `href`. */
  readonly url?: string;
  /** `target` for `url` links (e.g. `_blank`). */
  readonly target?: string;
  /** Disables the item — it renders muted and is not focusable. */
  readonly disabled?: boolean;
  /** Opaque payload echoed back on `(itemSelect)`. */
  readonly data?: unknown;
}
