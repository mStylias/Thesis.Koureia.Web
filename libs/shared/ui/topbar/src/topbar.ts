import { booleanAttribute, Component, input, model, signal } from '@angular/core';
import { LucideMenu, LucidePanelLeftClose, LucidePanelLeftOpen } from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { Button } from '@ui/button';

/**
 * Application top bar — the matched pair of `@ui/sidebar`, sitting to its right in the
 * desktop L-shape. Both bars pin their height to `--shell-header-height` rather than
 * treating it as a minimum, so their hairlines read as one unbroken rule whatever either
 * bar holds.
 *
 * Layout-only and slot-based. It owns **both of the sidebar's triggers** — the desktop
 * collapse toggle (`showSidebarToggle`) and the hamburger once the sidebar drops to a
 * drawer below 1024px; exactly one is ever visible. Everything else is projected:
 *
 * - `[libTopbarStart]` (or unslotted content): leading area — page title,
 *   breadcrumb, search…
 * - `[libTopbarEnd]`: trailing actions pinned to the right — buttons, a
 *   user menu, a theme toggle…
 *
 * ```ts
 * import { Topbar } from '@ui/topbar';
 * ```
 *
 * ```html
 * <lib-sidebar #nav [groups]="groups" [(collapsed)]="collapsed" [(mobileOpen)]="navOpen">…</lib-sidebar>
 *
 * <lib-topbar
 *   [(menuOpen)]="navOpen"
 *   showSidebarToggle
 *   [(sidebarCollapsed)]="collapsed"
 *   [sidebarControls]="nav.navId">
 *   <h1 libTopbarStart class="t-title">Ραντεβού</h1>
 *   <div libTopbarEnd>
 *     <button libButton severity="secondary" variant="text">Λογαριασμός</button>
 *   </div>
 * </lib-topbar>
 * ```
 *
 * One signal per state, bound to both bars: `[(menuOpen)]` here ↔ the sidebar's
 * `[(mobileOpen)]` (the hamburger opens the drawer; the drawer owns every close path), and
 * `[(sidebarCollapsed)]` ↔ `[(collapsed)]`.
 *
 * The collapse toggle lives here, not in the sidebar's header, deliberately: a control
 * mounted on a resizing panel repositions *within* it mid-animation and the eye follows
 * the button instead of the panel. Anchored to the bar it travels as one rigid body on the
 * sidebar's curve rather than as a second animation fighting the first.
 */
@Component({
  selector: 'lib-topbar',
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  imports: [
    LucideMenu,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    Button,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'topbar',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    class: 'topbar',
    // At most one `banner` per page; the sidebar is the `navigation` landmark.
    role: 'banner',
  },
})
export class Topbar {
  /**
   * Two-way state of the mobile navigation drawer. Bind the same signal to the sidebar's
   * `[(mobileOpen)]`. The hamburger that sets it shows only below 1024px.
   */
  readonly menuOpen = model(false);

  /** Accessible name of the hamburger; defaults to a translated string. */
  readonly menuAriaLabel = input('');

  /**
   * Renders the desktop sidebar collapse toggle. Opt-in: a top bar is usable with no
   * sidebar beside it, and the toggle would then control nothing.
   */
  readonly showSidebarToggle = input(false, { transform: booleanAttribute });

  /**
   * Two-way icon-rail state of the sidebar. Bind to the sidebar's `[(collapsed)]`; it
   * writes back too — a rail submenu parent expands the sidebar and the toggle follows.
   */
  readonly sidebarCollapsed = model(false);

  /**
   * Id for `aria-controls`, read off the sidebar:
   * `<lib-sidebar #nav />` … `[sidebarControls]="nav.navId"`. Omitted when empty.
   */
  readonly sidebarControls = input('');

  /**
   * Accessible name of the collapse toggle; defaults to a translated string. Names the
   * *thing* ("Navigation sidebar"), not the action — a name that flips to
   * "Expand"/"Collapse" is re-announced under the user's own focus. State rides
   * `aria-expanded`.
   */
  readonly sidebarToggleAriaLabel = input('');

  /**
   * Whether the toggle has been worked yet. Gates the icon swap's `animate.enter`, which
   * otherwise fires on first paint.
   */
  protected readonly sidebarToggled = signal(false);

  protected openMenu(): void {
    this.menuOpen.set(true);
  }

  protected toggleSidebar(): void {
    this.sidebarToggled.set(true);
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }
}
