import { Params } from '@angular/router';
import type { LucideIconInput } from '@lucide/angular';

/**
 * A single navigation option of the sidebar. Compared by reference,
 * so use stable object instances (a field initializer or a `computed()`).
 */
export interface SidebarItem {
  /** Text of the option; also the collapsed-rail tooltip and the accessible name. */
  readonly label: string;

  /** Leading Lucide icon — the only thing visible while collapsed. */
  readonly icon?: LucideIconInput;

  /** Router commands the option links to. */
  readonly routerLink?: string | readonly unknown[];

  /** Query parameters for `routerLink`. */
  readonly queryParams?: Params;

  /** External URL (ignored with `routerLink`). */
  readonly url?: string;

  /** Window target for `url`, e.g. `_blank`. */
  readonly target?: string;

  /** Focusable-looking but not activatable, rendered dimmed. */
  readonly disabled?: boolean;

  /** Set to `false` to omit the option entirely. */
  readonly visible?: boolean;

  /**
   * Sub-options — the item becomes an expandable toggle instead of a
   * link (`routerLink`/`url` are ignored). One level only: `items` of
   * children are ignored. While the sidebar is collapsed to the icon
   * rail, activating the toggle expands the sidebar and opens the
   * submenu.
   */
  readonly items?: readonly SidebarItem[];

  /** Whether a submenu starts expanded. */
  readonly expanded?: boolean;
}

/** A group of sidebar options, separated from its siblings by a hairline. */
export interface SidebarGroup {
  /** Optional small heading above the group; hidden while collapsed. */
  readonly label?: string;

  /** The group's navigation options. */
  readonly items: readonly SidebarItem[];

  /** Set to `false` to omit the group entirely. */
  readonly visible?: boolean;
}
