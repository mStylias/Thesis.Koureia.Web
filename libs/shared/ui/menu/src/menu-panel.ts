import { CdkConnectedOverlay, ConnectedPosition } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import {
  Menu as AriaMenu,
  MenuContent as AriaMenuContent,
  MenuItem as AriaMenuItem,
} from '@angular/aria/menu';
import { RouterLink, UrlTree } from '@angular/router';
import { LucideChevronRight, LucideDynamicIcon } from '@lucide/angular';
import { MenuItemTemplateContext } from './menu-templates';
import { inheritMenuTree } from './menu-tree';
import type { MenuSection } from './menu-panel.types';
import { MenuDensity, MenuItem } from './menu.types';

// Fallback for animateOut where no `animationend` arrives (test environments with no CSS
// animations): the leave duration plus margin.
const LEAVE_FALLBACK_MS = 250;

/** Source of generated `menu` element ids. */
let nextMenuId = 0;

/**
 * Submenus open to the right of their item, top-aligned so the first
 * child row lines up with the parent row (the offset cancels the panel
 * padding, `--space-1`). Fallbacks flip to the left, then bottom-align.
 */
const SUBMENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetY: -4 },
  { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom', offsetY: 4 },
  { originX: 'start', originY: 'bottom', overlayX: 'end', overlayY: 'bottom', offsetY: 4 },
];

/**
 * A vertical menu surface rendering typed `MenuItem` entries on the headless
 * `@angular/aria/menu` pattern, which supplies roving focus, arrow/Home/End navigation,
 * typeahead, submenus and the ARIA contract.
 *
 * Hosted inside an overlay by a wrapper such as `@ui/context-menu`. Activation is reported
 * through `itemSelected`; interpreting `command`/`routerLink`/`url` is the wrapper's job.
 */
@Component({
  selector: 'lib-menu-panel',
  imports: [
    AriaMenu,
    AriaMenuContent,
    LucideDynamicIcon,
    NgTemplateOutlet,
    forwardRef(() => MenuNode),
  ],
  template: `
    <div
      ngMenu
      class="menu"
      [id]="resolvedMenuId()"
      [attr.aria-label]="ariaLabel() || null"
      [expansionDelay]="expansionDelay()"
      (itemSelected)="onItemSelected($event)"
    >
      <ng-template ngMenuContent>
        @for (section of sections(); track $index) {
          @if (section.heading; as heading) {
            <!-- A heading inside a menu has no role of its own, so it names a group. -->
            <div class="menu-group" role="group" [attr.aria-labelledby]="section.headingId">
              <div class="menu-heading" role="presentation" [id]="section.headingId">
                @if (heading.icon; as icon) {
                  <svg [lucideIcon]="icon" class="menu-heading-icon" aria-hidden="true"></svg>
                }
                <span class="menu-heading-label">{{ heading.label }}</span>
              </div>
              @for (entry of section.entries; track $index) {
                <ng-container
                  [ngTemplateOutlet]="row"
                  [ngTemplateOutletContext]="{ $implicit: entry }"
                />
              }
            </div>
          } @else {
            @for (entry of section.entries; track $index) {
              <ng-container
                [ngTemplateOutlet]="row"
                [ngTemplateOutletContext]="{ $implicit: entry }"
              />
            }
          }
        }

        <ng-template #row let-entry>
          @if (entry.separator) {
            <div class="menu-separator" role="separator" aria-orientation="horizontal"></div>
          } @else {
            <lib-menu-node
              [item]="entry"
              [itemTemplate]="itemTemplate()"
              [expansionDelay]="expansionDelay()"
              [density]="density()"
              [parentVisible]="visible()"
            />
          }
        </ng-template>
      </ng-template>
    </div>
  `,
  styleUrl: './menu-panel.scss',
  host: {
    '[attr.data-closing]': 'closing() ? "" : null',
    '[attr.data-density]': 'density()',
  },
})
export class MenuPanel {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Entries to render; `separator: true` rows become dividers. */
  readonly items = input.required<readonly MenuItem[]>();

  /** Custom row template (from `libMenuItem`). */
  readonly itemTemplate = input<TemplateRef<MenuItemTemplateContext> | undefined>(undefined);

  /** Accessible name of the `menu` element. */
  readonly ariaLabel = input('');

  /**
   * Row height and text size. `compact` suits a menu that answers one control
   * — a column's options, a filter's operation — where the command-list
   * metrics of `standard` dwarf the control the menu belongs to. Applies to
   * submenus as well.
   */
  readonly density = input<MenuDensity>('standard');

  /**
   * Explicit id for the `menu` element, so a trigger's `aria-controls`
   * can point at it. Falls back to a generated id when unset.
   */
  readonly menuId = input('');

  /**
   * Hover open/close delay in ms. Generous by default so a diagonal pointer path — which
   * crosses sibling rows, each scheduling a close — reaches the submenu before it fires.
   */
  readonly expansionDelay = input(300);

  private readonly fallbackId = `lib-menu-${nextMenuId++}`;

  /** The id actually applied to the `menu` element. */
  readonly resolvedMenuId = computed(() => this.menuId() || this.fallbackId);

  /**
   * Fires when a leaf item is activated, from any depth of the tree —
   * the aria pattern reports every activation at the root menu.
   */
  readonly itemSelected = output<MenuItem>();

  /** The aria menu directive, used as the `[submenu]` of parent items. */
  readonly menu = viewChild.required<AriaMenu<MenuItem>>(AriaMenu);

  /** Whether the aria pattern currently shows this panel. */
  readonly visible = computed(() => this.menu().visible());

  protected readonly closing = signal(false);

  protected readonly visibleItems = computed(() =>
    this.items().filter((item) => item.visible !== false),
  );

  /** The visible entries, split at each heading. */
  protected readonly sections = computed(() => {
    const sections: MenuSection[] = [];
    for (const item of this.visibleItems()) {
      if (item.heading) {
        const headingId = `${this.resolvedMenuId()}-heading-${sections.length}`;
        sections.push({ heading: item, headingId, entries: [] });
        continue;
      }
      const last = sections.at(-1);
      if (last === undefined) sections.push({ heading: null, headingId: '', entries: [item] });
      else last.entries.push(item);
    }
    return sections;
  });

  /**
   * Clears the pattern's default active item, so nothing reads as highlighted and the
   * first ArrowDown lands on item one rather than skipping it. Reaches into pattern
   * internals; there is no public API for it.
   */
  clearActiveItem(): void {
    this.menu()._pattern.listBehavior.unfocus();
  }

  /**
   * Plays the leave animation (`data-closing` on the host) and
   * resolves once it is safe to detach the hosting overlay.
   */
  animateOut(): Promise<void> {
    if (this.closing()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const host = this.elementRef.nativeElement;
      let settled = false;

      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        host.removeEventListener('animationend', onAnimationEnd);
        resolve();
      };

      const onAnimationEnd = (event: Event): void => {
        // Emulated encapsulation rewrites keyframe names, so match loosely.
        if ((event as AnimationEvent).animationName.includes('menu-out')) {
          finish();
        }
      };

      host.addEventListener('animationend', onAnimationEnd);
      this.closing.set(true);
      setTimeout(finish, LEAVE_FALLBACK_MS);
    });
  }

  protected onItemSelected(value: unknown): void {
    this.itemSelected.emit(value as MenuItem);
  }
}

/**
 * One menu row plus, for items with children, the connected overlay hosting its submenu.
 * Internal to `MenuPanel`: the extra component exists so each submenu gets its own
 * `viewChild` for the pattern's `[submenu]` wiring. The host is `display: contents` so the
 * row stays a direct box, and accessibility child, of the `menu` element.
 *
 * The submenu overlay stays attached but hidden while the parent is visible, so the aria
 * `MenuItem` always sees its instance; the pattern toggles `data-visible`.
 */
@Component({
  selector: 'lib-menu-node',
  imports: [
    AriaMenuItem,
    CdkConnectedOverlay,
    NgTemplateOutlet,
    RouterLink,
    LucideDynamicIcon,
    MenuPanel,
  ],
  template: `
    @if (hasChildren()) {
      <!-- Submenu trigger: a div that owns the nested overlay. -->
      <div
        ngMenuItem
        #itemElement
        class="menu-item"
        [attr.data-danger]="item().danger ? '' : null"
        [value]="item()"
        [disabled]="!!item().disabled"
        [searchTerm]="item().label ?? ''"
        [submenu]="submenuPanel()?.menu()"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </div>
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="itemElement"
        [cdkConnectedOverlayOpen]="parentVisible()"
        [cdkConnectedOverlayPositions]="submenuPositions"
        (attach)="onSubmenuOverlayAttach()"
      >
        <lib-menu-panel
          [items]="item().items!"
          [itemTemplate]="itemTemplate()"
          [expansionDelay]="expansionDelay()"
          [density]="density()"
        />
      </ng-template>
    } @else if (isRouterLink()) {
      <!-- Router link: real anchor for status bar, modifier-click new
           tab, and "copy link". Plain clicks navigate via RouterLink;
           keyboard activation is handled programmatically upstream. -->
      <a
        ngMenuItem
        class="menu-item"
        [attr.data-danger]="item().danger ? '' : null"
        [value]="item()"
        [searchTerm]="item().label ?? ''"
        [role]="itemRole()"
        [attr.aria-checked]="ariaChecked()"
        [routerLink]="routerLink()!"
        [queryParams]="isUrlTree() ? null : (item().queryParams ?? null)"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </a>
    } @else if (externalUrl(); as url) {
      <!-- External link: real anchor with a plain href. -->
      <a
        ngMenuItem
        class="menu-item"
        [attr.data-danger]="item().danger ? '' : null"
        [value]="item()"
        [searchTerm]="item().label ?? ''"
        [role]="itemRole()"
        [attr.aria-checked]="ariaChecked()"
        [attr.href]="url"
        [attr.target]="item().target ?? null"
        [attr.rel]="item().target === '_blank' ? 'noopener' : null"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </a>
    } @else {
      <!-- Plain item, and every disabled item: a disabled link must not
           keep an href, or the browser would navigate it natively no
           matter what the aria pattern thinks. Activation of an enabled
           row is reported through itemSelected. -->
      <div
        ngMenuItem
        class="menu-item"
        [attr.data-danger]="item().danger ? '' : null"
        [value]="item()"
        [disabled]="!!item().disabled"
        [searchTerm]="item().label ?? ''"
        [role]="itemRole()"
        [attr.aria-checked]="ariaChecked()"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </div>
    }

    <ng-template #content>
      @if (itemTemplate(); as template) {
        <ng-container
          [ngTemplateOutlet]="template"
          [ngTemplateOutletContext]="{ $implicit: item() }"
        />
      } @else {
        @if (item().icon; as icon) {
          <svg [lucideIcon]="icon" class="menu-item-icon" aria-hidden="true"></svg>
        }
        <span class="menu-item-label">{{ item().label }}</span>
        @if (item().shortcut; as shortcut) {
          <span class="menu-item-shortcut">{{ shortcut }}</span>
        }
        @if (hasChildren()) {
          <svg [lucideIcon]="chevronIcon" class="menu-item-chevron" aria-hidden="true"></svg>
        }
      }
    </ng-template>
  `,
  styleUrl: './menu-node.scss',
})
export class MenuNode {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The entry this row renders. */
  readonly item = input.required<MenuItem>();

  /** Custom row template, forwarded down the submenu tree. */
  readonly itemTemplate = input<TemplateRef<MenuItemTemplateContext> | undefined>(undefined);

  /** Whether the owning menu is visible — keeps the submenu attached. */
  readonly parentVisible = input.required<boolean>();

  /** Hover open/close delay, forwarded down the submenu tree. */
  readonly expansionDelay = input(300);

  /**
   * Density, forwarded down the submenu tree. A submenu's panel is in an
   * overlay of its own, so the parent's custom properties never reach it.
   */
  readonly density = input<MenuDensity>('standard');

  protected readonly submenuPanel = viewChild(MenuPanel);
  private readonly connectedOverlay = viewChild(CdkConnectedOverlay);

  /** The menu this row belongs to. */
  private readonly parentMenu = inject<AriaMenu<MenuItem>>(AriaMenu);

  protected readonly hasChildren = computed(() => (this.item().items?.length ?? 0) > 0);

  /**
   * `menuitemradio`/`menuitemcheckbox` for an item that carries state, plain
   * `menuitem` otherwise. A submenu trigger keeps `menuitem`: it opens a list
   * rather than settling a choice, so state belongs on the rows inside it.
   */
  protected readonly itemRole = computed<'menuitem' | 'menuitemradio' | 'menuitemcheckbox'>(() => {
    const item = this.item();
    if (item.checked === undefined || this.hasChildren()) {
      return 'menuitem';
    }
    return item.checkedRole === 'checkbox' ? 'menuitemcheckbox' : 'menuitemradio';
  });

  /** `aria-checked` for a stateful row, and nothing at all for the rest. */
  protected readonly ariaChecked = computed(() =>
    this.itemRole() === 'menuitem' ? null : String(this.item().checked === true),
  );

  /**
   * `routerLink` normalised for the directive: a mutable array (its input rejects
   * `readonly`), a string or a `UrlTree`, `undefined` otherwise. Only leaves link — a submenu
   * trigger is never an anchor.
   */
  protected readonly routerLink = computed<string | unknown[] | UrlTree | undefined>(() => {
    const link = this.item().routerLink;
    if (link === undefined || typeof link === 'string' || link instanceof UrlTree) {
      return link;
    }
    return [...link];
  });

  /**
   * A disabled item never renders as an anchor. `aria-disabled` stops the menu selecting
   * it, but a live `href` would still let the browser navigate on click or Enter. Dropping
   * the link falls through to the plain row, which does carry `[disabled]`.
   */
  /** A `UrlTree` carries its own query. The directive throws when it gets `queryParams` too. */
  protected readonly isUrlTree = computed(() => this.item().routerLink instanceof UrlTree);

  protected readonly isRouterLink = computed(
    () => !this.item().disabled && this.routerLink() !== undefined,
  );

  protected readonly externalUrl = computed(() =>
    this.item().disabled ? undefined : this.item().url,
  );

  protected readonly chevronIcon = LucideChevronRight;
  protected readonly submenuPositions = SUBMENU_POSITIONS;

  constructor() {
    // The overlay attaches while the submenu is display:none, so its flip decision is
    // made against an empty pane. Re-measure the moment it actually shows.
    afterRenderEffect(() => {
      if (this.submenuPanel()?.visible()) {
        untracked(() => this.connectedOverlay()?.overlayRef.updatePosition());
      }
    });
  }

  /**
   * Marks the submenu pane as part of the same menu tree as this row —
   * the owning overlay controller uses the stamp to tell its own
   * submenus apart from unrelated menus when focus moves.
   *
   * Then two corrections to the pattern's hover handling, needed
   * because it assumes submenus are DOM-nested inside their parent menu
   * while ours render in detached overlay panes. Both listeners die
   * with the pane when the overlay detaches.
   *
   * 1. Its `mouseout` containment check treats the submenu's own
   *    internal transitions (padding → item, item → item before focus
   *    lands inside) as "left the menu" and closes it instantly —
   *    swallow `mouseout` in the capture phase whenever the pointer
   *    stays within the menu tree.
   * 2. It cancels a pending hover-close only when an *item* is
   *    hovered, so entering through the pane's padding would let the
   *    close fire under the pointer — cancel the owning menu's hover
   *    timers as soon as the pane is entered at all.
   */
  protected onSubmenuOverlayAttach(): void {
    const pane = this.connectedOverlay()?.overlayRef.overlayElement;
    if (!pane) {
      return;
    }

    inheritMenuTree(this.elementRef.nativeElement, pane);

    pane.addEventListener(
      'mouseout',
      (event) => {
        const to = event.relatedTarget;
        if (to instanceof Element && (pane.contains(to) || to.closest('[role="menu"]'))) {
          event.stopPropagation();
        }
      },
      true,
    );

    pane.addEventListener('mouseenter', () => {
      this.parentMenu._pattern._clearTimeouts();
    });
  }
}
