import { Component, afterNextRender, computed, inject, isDevMode, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { StaffAccessStore } from '@auth/data-access';
import { ThemePreferenceSync } from '@features/management-profile';
import { Sidebar, SidebarBrand, SidebarBrandText, type SidebarGroup } from '@ui/sidebar';
import { ThemeToggle } from '@ui/theme-toggle';
import { Topbar } from '@ui/topbar';
import { BRAND } from '@util/brand';
import { filter, skip } from 'rxjs';

import { ManagementAccountMenu } from '../management-account-menu/management-account-menu';
import { managementTranslocoScope } from '../management.i18n';
import { MANAGEMENT_BASE_PATH, MANAGEMENT_SECTIONS } from '../management-pages';
import { prefetchPageDictionaries } from '../page-dictionaries';
import { WorkspaceShopPicker } from '../workspace-shop-picker/workspace-shop-picker';
import { SidebarCollapseStore } from './sidebar-collapse.store';

/**
 * The management shell: the sidebar on the left, the top bar above the routed page, and the
 * page itself in the outlet. Every `/management` address renders inside it.
 *
 * The sidebar ships no trigger of its own, so both of its states are held here and bound to
 * `lib-topbar`, which owns the desktop collapse toggle and the mobile hamburger.
 */
@Component({
  selector: 'lib-management-shell',
  templateUrl: './management-shell.html',
  styleUrl: './management-shell.scss',
  imports: [
    ManagementAccountMenu,
    RouterLink,
    RouterOutlet,
    Sidebar,
    SidebarBrand,
    SidebarBrandText,
    ThemeToggle,
    Topbar,
    TranslocoPipe,
    WorkspaceShopPicker,
  ],
  // The route resolver already loaded this dictionary, so the first render is translated.
  // Providing the scope keeps it loaded if the language changes underneath. The theme sync is
  // here so the profile page writes through the same instance the shell reads with.
  providers: [provideTranslocoScope(managementTranslocoScope), ThemePreferenceSync],
})
export class ManagementShell {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  /**
   * Resolved before this component exists: `managementAccessGuard` awaits it, and a guard runs
   * before the route's component is created. So the first render already knows what to draw.
   */
  protected readonly access = inject(StaffAccessStore);

  /** Read per injection, never cached at module scope — see `BrandConfig`. */
  protected readonly brand = inject(BRAND);

  protected readonly home = MANAGEMENT_BASE_PATH;

  /**
   * A page stays lit while a child route of it is open, which is how a panel
   * over the list — `roles/new` — keeps its own entry marked. Held rather than
   * written in the template: a fresh object per change detection would rewrite
   * the input on every pass.
   */
  protected readonly navMatch = { exact: false };

  /**
   * The theme toggle is a development control, not a published one.
   *
   * A constant and not a signal: the build decides this and it cannot change while the page is
   * open. `lib.routes.ts` gates the toggle's dictionary on the same condition.
   */
  protected readonly showThemeToggle = isDevMode();

  /** Icon rail, desktop only. Bound to both bars, and kept in `localStorage` between visits. */
  protected readonly collapsed = inject(SidebarCollapseStore).collapsed;

  /** Mobile drawer. The top bar's hamburger opens it; the drawer owns every close path. */
  protected readonly navOpen = signal(false);

  /**
   * Keys the outlet. A superadmin's shop change re-creates the routed page, so its
   * component-provided store starts fresh even when the home page is already open.
   */
  protected readonly shopKey = computed(() => this.access.company()?.id ?? '');

  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /**
   * Sidebar groups, one per section. Rebuilt per language because `SidebarGroup` carries plain
   * strings, which no pipe can reach.
   *
   * A page the account holds no permission for is left out, and a group left with no page goes
   * with it. This is presentation only — `managementPageGuard` is what refuses the address, and
   * the API refuses the calls behind it a third time.
   */
  protected readonly groups = computed<readonly SidebarGroup[]>(() => {
    this.activeLang();

    return MANAGEMENT_SECTIONS.map((section) => ({
      label: this.transloco.translate(section.headingKey),
      items: section.pages
        .filter((page) => this.access.has(page.permission))
        .map((page) => ({
          label: this.transloco.translate(page.titleKey),
          icon: page.icon,
          routerLink: `${MANAGEMENT_BASE_PATH}/${page.path}`,
        })),
    })).filter((group) => group.items.length > 0);
  });

  private readonly pageTitleKey = signal(readDeepestTitle(this.router.routerState.snapshot.root));

  /** The name of the page in the outlet — the only thing the top bar carries. */
  protected readonly pageTitle = computed(() => {
    this.activeLang();
    const key = this.pageTitleKey();
    return key === '' ? '' : this.transloco.translate(key);
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.pageTitleKey.set(readDeepestTitle(this.router.routerState.snapshot.root));
      });

    // After the first page is drawn, so the prefetch never competes with it. The account's
    // theme replaces this browser's, once per shell start.
    const themeSync = inject(ThemePreferenceSync);
    afterNextRender(() => {
      prefetchPageDictionaries(this.transloco);
      void themeSync.sync();
    });
    this.transloco.langChanges$.pipe(skip(1), takeUntilDestroyed()).subscribe(() => {
      prefetchPageDictionaries(this.transloco);
    });
  }
}

/**
 * The `title` of the deepest activated route — the routed page, not this shell. The value is a
 * Transloco key, the same one the sidebar option and the browser tab read.
 */
function readDeepestTitle(root: ActivatedRouteSnapshot): string {
  let route = root;
  while (route.firstChild !== null) route = route.firstChild;
  return route.title ?? '';
}
