import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  inject,
  input,
  model,
  output,
  signal,
  TemplateRef,
  contentChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { LucideChevronDown, LucideChevronRight, LucideDynamicIcon } from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { Drawer, DrawerHeader } from '@ui/drawer';
import { Tooltip } from '@ui/tooltip';
import { SidebarGroup, SidebarItem } from './sidebar.types';

/**
 * Above this width the sidebar renders in-flow; below it, as a modal drawer. Mirrors
 * `$breakpoints.lg`, which is deliberately not a CSS custom property — `var()` does not
 * work inside `@media`. Keep in sync with the query in `sidebar.scss`.
 */
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

let nextSidebarId = 0;

/**
 * Marks the template rendered as the sidebar's brand area — typically a
 * home link with the product logo and name:
 *
 * ```html
 * <a *libSidebarBrand routerLink="/">
 *   <svg lucideScissors></svg>
 *   <span libSidebarBrandText>Barbershop</span>
 * </a>
 * ```
 *
 * A template rather than projected content because the brand renders twice: the desktop
 * header row and the mobile drawer's header.
 */
@Directive({ selector: '[libSidebarBrand]' })
export class SidebarBrand {
  readonly templateRef = inject(TemplateRef);
}

/** Brand text, hidden while collapsed so only the icon remains. */
@Directive({ selector: '[libSidebarBrandText]' })
export class SidebarBrandText {}

/**
 * Application navigation sidebar: groups of icon+label `<a>` links, the active one tracking
 * the current route, below a brand header row. Collapsed it becomes an icon-only rail whose
 * options name themselves in tooltips; below 1024px it leaves the flow and opens as a modal
 * drawer through `[(mobileOpen)]`.
 *
 * **It renders no trigger of its own.** The collapse toggle and the hamburger both live in
 * `lib-topbar`; bind one signal per state to both bars. Keeping the toggle outside means it
 * does not have to reposition within a panel that is itself resizing.
 *
 * ```ts
 * import { Sidebar, SidebarGroup } from '@ui/sidebar';
 * ```
 *
 * ```html
 * <lib-sidebar #nav [groups]="groups" [(collapsed)]="collapsed" [(mobileOpen)]="navOpen">
 *   <a *libSidebarBrand routerLink="/">
 *     <svg lucideScissors></svg>
 *     <span libSidebarBrandText>Barbershop</span>
 *   </a>
 * </lib-sidebar>
 *
 * <lib-topbar
 *   [(menuOpen)]="navOpen"
 *   showSidebarToggle
 *   [(sidebarCollapsed)]="collapsed"
 *   [sidebarControls]="nav.navId" />
 * ```
 *
 * ```ts
 * nav: SidebarGroup[] = [
 *   { items: [{ label: 'Αρχική', icon: LucideHouse, routerLink: '/' }] },
 *   { label: 'Διαχείριση', items: [{ label: 'Ρυθμίσεις', icon: LucideSettings, routerLink: '/settings' }] },
 * ];
 * ```
 *
 * Items using `queryParams` may want `[routerLinkActiveOptions]="{ exact: false }"` —
 * exact matching compares query params too.
 */
@Component({
  selector: 'lib-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    LucideChevronDown,
    LucideChevronRight,
    LucideDynamicIcon,
    TranslocoPipe,
    UiCopyPipe,
    Drawer,
    DrawerHeader,
    Tooltip,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'sidebar',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    class: 'sidebar',
    '[attr.data-collapsed]': 'collapsed() && isDesktop() ? "" : null',
    '[attr.data-compact]': 'compact() && isDesktop() ? "" : null',
    '[attr.data-mobile]': 'isDesktop() ? null : ""',
  },
})
export class Sidebar {
  /** Navigation groups, separated by hairlines. */
  readonly groups = input<readonly SidebarGroup[]>([]);

  /**
   * Two-way icon-rail state (desktop only). Bind to `lib-topbar`'s
   * `[(sidebarCollapsed)]`, and to storage if the rail should survive a reload. The sidebar
   * writes to it in one case: a submenu parent activated in the rail, which has nowhere to
   * put its children.
   */
  readonly collapsed = model(false);

  /** Denser rows for option-heavy navigations. Desktop only; the drawer keeps 44px targets. */
  readonly compact = input(false, { transform: booleanAttribute });

  /**
   * Two-way visibility of the mobile drawer. Bind to `lib-topbar`'s `[(menuOpen)]` or your
   * own hamburger. Closes itself on navigation, Escape and backdrop clicks.
   */
  readonly mobileOpen = model(false);

  /** Accessible name of the navigation landmark; defaults translated. */
  readonly ariaLabel = input('');

  /** Passed to each `routerLinkActive`. Exact by default, so parents don't stay lit. */
  readonly routerLinkActiveOptions = input<{ exact: boolean }>({ exact: true });

  /** Emitted when an enabled option is activated. */
  readonly itemSelect = output<SidebarItem>();

  /**
   * Id of the desktop `<nav>` landmark, so an outside toggle can point `aria-controls` at
   * what it expands: `<lib-sidebar #nav />` … `[sidebarControls]="nav.navId"`.
   */
  readonly navId = `lib-sidebar-nav-${nextSidebarId++}`;

  protected readonly brand = contentChild(SidebarBrand);

  protected readonly visibleGroups = computed(() =>
    this.groups()
      .filter((group) => group.visible !== false)
      .map((group) => ({
        label: group.label,
        items: group.items.filter((item) => item.visible !== false),
      }))
      .filter((group) => group.items.length > 0),
  );

  // The server and first client frame render the desktop branch, which a media query hides
  // on small screens until this flips — avoiding both a flash and a hydration mismatch.
  private readonly isDesktopState = signal(true);
  protected readonly isDesktop = this.isDesktopState.asReadonly();

  constructor() {
    const breakpoints = inject(BreakpointObserver);
    const destroyRef = inject(DestroyRef);
    // afterNextRender is browser-only, so this is SSR-safe by construction.
    afterNextRender(() => {
      breakpoints
        .observe(DESKTOP_MEDIA_QUERY)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe((result) => {
          this.isDesktopState.set(result.matches);
        });
    });

    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.mobileOpen.set(false);
      });
  }

  /** User-driven submenu overrides, layered over `item.expanded`. */
  private readonly submenuToggles = signal<ReadonlyMap<SidebarItem, boolean>>(new Map());

  protected visibleChildren(item: SidebarItem): readonly SidebarItem[] {
    return item.items?.filter((child) => child.visible !== false) ?? [];
  }

  protected isExpanded(item: SidebarItem): boolean {
    return this.submenuToggles().get(item) ?? item.expanded ?? false;
  }

  protected toggleSubmenu(item: SidebarItem): void {
    if (item.disabled) {
      return;
    }
    // In the rail the children have nowhere to render: expand, then open.
    if (this.collapsed() && this.isDesktop()) {
      this.collapsed.set(false);
      this.setSubmenu(item, true);
      return;
    }
    this.setSubmenu(item, !this.isExpanded(item));
  }

  private setSubmenu(item: SidebarItem, expanded: boolean): void {
    this.submenuToggles.update((toggles) => {
      const next = new Map(toggles);
      next.set(item, expanded);
      return next;
    });
  }

  protected onSelect(item: SidebarItem, event: MouseEvent): void {
    if (item.disabled) {
      event.preventDefault();
      return;
    }
    this.itemSelect.emit(item);
    // NavigationEnd covers router links, but external `url` items never
    // produce one — close the drawer for those too.
    this.mobileOpen.set(false);
  }
}
