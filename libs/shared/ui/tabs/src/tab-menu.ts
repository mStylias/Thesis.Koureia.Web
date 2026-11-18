import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TabMenuItem } from './tabs.types';

/**
 * A tab-styled navigation bar. Unlike `lib-tabs` it has no panels — each item navigates.
 * Renders a `navigation` landmark of real `<a>` links, so status bar, open-in-new-tab and
 * copy link all work, with the active item tracking the route via `routerLinkActive`.
 *
 * ```ts
 * import { TabMenu, TabMenuItem } from '@ui/tabs';
 * ```
 *
 * ```html
 * <lib-tab-menu [items]="navItems" ariaLabel="Account sections" />
 * ```
 *
 * ```ts
 * navItems: TabMenuItem[] = [
 *   { label: 'Overview', routerLink: '/account' },
 *   { label: 'Bookings', routerLink: '/account/bookings' },
 *   { label: 'Help', url: 'https://example.com/help', target: '_blank' },
 * ];
 * ```
 */
@Component({
  selector: 'lib-tab-menu',
  templateUrl: './tab-menu.html',
  styleUrl: './tab-menu.scss',
  imports: [RouterLink, RouterLinkActive],
  host: {
    class: 'tab-menu',
    role: 'navigation',
    '[attr.aria-label]': 'ariaLabel() || null',
  },
})
export class TabMenu {
  /** Navigation entries. */
  readonly items = input<readonly TabMenuItem[]>([]);

  /** Accessible name for the navigation landmark. */
  readonly ariaLabel = input('');

  /** Passed to each `routerLinkActive`. Exact by default, so parents don't stay lit. */
  readonly routerLinkActiveOptions = input<{ exact: boolean }>({ exact: true });

  /** Emitted when an enabled item is activated. */
  readonly itemSelect = output<TabMenuItem>();

  protected onSelect(item: TabMenuItem, event: MouseEvent): void {
    if (item.disabled) {
      event.preventDefault();
      return;
    }
    this.itemSelect.emit(item);
  }
}
