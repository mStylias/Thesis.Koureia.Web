import { ConnectedPosition } from '@angular/cdk/overlay';
import {
  afterEveryRender,
  AfterRenderRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { PopoverAnchor, PopoverRef, PopoverService } from '@ui/popover';
import { MenuPanel } from './menu-panel';
import { createMenuTreeId, MENU_TREE_ATTRIBUTE } from './menu-tree';
import { MenuItem } from './menu.types';

/**
 * A row of any role: `checked` makes it `menuitemradio` or `menuitemcheckbox`. A menu of checked
 * rows only never matched `menuitem`, so it kept the place it got while empty and took no focus.
 */
const MENU_ROWS = ['menuitem', 'menuitemradio', 'menuitemcheckbox'].map(
  (role) => `[role="${role}"]`,
);
const MENU_ROW = MENU_ROWS.join(', ');
const MENU_ROW_TABBABLE = MENU_ROWS.map((row) => `${row}[tabindex="0"]`).join(', ');

/** Everything the controller needs from its host component. */
export interface MenuOverlayDeps {
  readonly popover: PopoverService;
  readonly document: Document;
  readonly router: Router | null;
  readonly injector: Injector;
  readonly viewContainerRef: ViewContainerRef;
  /** The template that renders the `lib-menu-panel`. */
  readonly panelTemplate: () => TemplateRef<unknown>;
  /** The rendered panel, for focus/animation/active-item control. */
  readonly panel: () => MenuPanel | undefined;
  /** Fired after the menu opens. */
  readonly onOpened: () => void;
  /** Fired after the menu starts closing, whatever the reason. */
  readonly onClosed: () => void;
}

/** How a menu overlay should be opened. */
export interface MenuOpenOptions {
  /** Anchor: an element (dropdown) or a viewport point (context menu). */
  readonly anchor: PopoverAnchor;
  /** Position list handed to the popover. */
  readonly positions: readonly ConnectedPosition[];
  /** Highlight the first item on open. Pointer opens leave nothing highlighted. */
  readonly focusFirstItem: boolean;
  /** The event that opened the menu, forwarded to `command`. */
  readonly triggerEvent?: Event;
}

/**
 * Shared engine for the button-triggered `Menu` and the right-click `ContextMenu`. Renders
 * a `lib-menu-panel` through the popover primitive and owns everything identical to both:
 * initial focus, focus-out dismissal across detached submenu panes, pointer-vs-keyboard
 * activation, and running an item's `command`/`routerLink`/`url`. Hosts add only their
 * own trigger semantics.
 */
export class MenuOverlayController {
  private popoverRef: PopoverRef | null = null;
  private restoreFocusElement: Element | null = null;
  private lastTriggerEvent: Event | null = null;
  private initialFocusRef: AfterRenderRef | null = null;
  private focusFirstOnOpen = false;
  private pointerActivation = false;
  private focusOutCheck: ReturnType<typeof setTimeout> | null = null;
  private readonly treeId = createMenuTreeId();

  constructor(private readonly deps: MenuOverlayDeps) {}

  /** Whether the menu is currently open. */
  get isOpen(): boolean {
    return this.popoverRef !== null;
  }

  /** The open menu's overlay pane, or `null` when closed. */
  get overlayElement(): HTMLElement | null {
    return this.popoverRef?.overlayElement ?? null;
  }

  /** Opens the menu, or re-anchors it if already open. */
  open(options: MenuOpenOptions): void {
    this.lastTriggerEvent = options.triggerEvent ?? null;
    this.restoreFocusElement = this.deps.document.activeElement;
    this.focusFirstOnOpen = options.focusFirstItem;

    if (this.popoverRef) {
      this.popoverRef.updateAnchor(options.anchor);
      this.applyInitialFocus();
      return;
    }

    const popoverRef = this.deps.popover.open({
      anchor: options.anchor,
      template: this.deps.panelTemplate(),
      viewContainerRef: this.deps.viewContainerRef,
      positions: options.positions,
      scrollBehavior: 'close',
      beforeDispose: () => this.deps.panel()?.animateOut() ?? Promise.resolve(),
      onClose: (reason) => {
        this.clearFocusOutCheck();
        this.deps.document.removeEventListener('focusout', this.onFocusOut, true);
        this.deps.document.removeEventListener('click', this.onPointerActivate, true);
        this.popoverRef = null;
        this.deps.onClosed();
        if (reason === 'escape') {
          this.restoreFocus();
        }
      },
    });
    this.popoverRef = popoverRef;

    // Claims the pane for this tree; submenu panes inherit the stamp as they attach, which
    // scopes the focus-out check to *this* menu rather than every menu on the page.
    popoverRef.overlayElement.setAttribute(MENU_TREE_ATTRIBUTE, this.treeId);

    // Tab moves focus out and the WAI-ARIA pattern closes. On the document because submenus
    // render in their own panes: hopping between panes is not leaving, but leaving from one
    // must still close.
    this.deps.document.addEventListener('focusout', this.onFocusOut, true);
    // Flags the next activation pointer-driven, so links skip the navigation the anchor did.
    this.deps.document.addEventListener('click', this.onPointerActivate, true);

    this.deps.onOpened();
    this.scheduleInitialFocus();
  }

  /** Closes the menu without restoring focus. */
  close(): void {
    void this.popoverRef?.close();
  }

  /** Tears the overlay down immediately (host `ngOnDestroy`). */
  destroy(): void {
    this.clearFocusOutCheck();
    this.deps.document.removeEventListener('focusout', this.onFocusOut, true);
    this.deps.document.removeEventListener('click', this.onPointerActivate, true);
    this.initialFocusRef?.destroy();
    this.popoverRef?.dispose();
    this.popoverRef = null;
  }

  /** Runs an activated item's action, then closes and restores focus. */
  handleItemSelected(item: MenuItem): void {
    const viaPointer = this.pointerActivation;

    item.command?.({
      originalEvent: this.lastTriggerEvent ?? undefined,
      item,
    });

    // The anchor handles a pointer click natively (SPA routing, modifier/middle-click,
    // status-bar preview), so navigate programmatically only for keyboard activation, which
    // the pattern routes here without a native click.
    const isLink = item.routerLink !== undefined || !!item.url;
    if (!(isLink && viaPointer)) {
      if (item.routerLink instanceof UrlTree) {
        void this.deps.router?.navigateByUrl(item.routerLink);
      } else if (item.routerLink !== undefined) {
        const commands: unknown[] =
          typeof item.routerLink === 'string' ? [item.routerLink] : [...item.routerLink];
        void this.deps.router?.navigate(commands, {
          queryParams: item.queryParams,
        });
      } else if (item.url) {
        const window = this.deps.document.defaultView;
        if (item.target) {
          window?.open(item.url, item.target);
        } else if (window) {
          window.location.href = item.url;
        }
      }
    }

    this.close();
    this.restoreFocus();
  }

  private readonly onFocusOut = (event: FocusEvent): void => {
    if (!this.inMenuTree(event.target)) {
      return;
    }

    if (event.relatedTarget instanceof Element) {
      if (!this.inMenuTree(event.relatedTarget)) {
        this.close();
      }
      return;
    }

    // No `relatedTarget`: focus went somewhere unnameable — body, chrome, another document.
    // Some are real departures, some transient (moving between panes lands on the body
    // first), so settle on the next task and judge by where focus ended up.
    this.scheduleFocusOutCheck();
  };

  /**
   * Closes unless focus came back. A document that no longer holds focus counts as
   * leaving, even though it keeps reporting the last element as `activeElement`.
   */
  private scheduleFocusOutCheck(): void {
    if (this.focusOutCheck !== null) {
      return;
    }
    this.focusOutCheck = setTimeout(() => {
      this.focusOutCheck = null;
      if (!this.isOpen) {
        return;
      }
      const returned =
        this.inMenuTree(this.deps.document.activeElement) && this.deps.document.hasFocus();
      if (!returned) {
        this.close();
      }
    });
  }

  private clearFocusOutCheck(): void {
    if (this.focusOutCheck !== null) {
      clearTimeout(this.focusOutCheck);
      this.focusOutCheck = null;
    }
  }

  /**
   * Whether a node belongs to this menu's tree of panes — the root, or a submenu stamped
   * with its tree id. Scoped deliberately: an unrelated open `role="menu"` elsewhere is
   * somewhere else to have gone, not part of this one.
   */
  private inMenuTree(node: unknown): boolean {
    if (!(node instanceof Element)) {
      return false;
    }
    return (
      !!this.popoverRef?.overlayElement.contains(node) ||
      !!node.closest(`[${MENU_TREE_ATTRIBUTE}="${this.treeId}"]`)
    );
  }

  /**
   * Records that the imminent `itemSelected` came from a pointer click. Cleared on a
   * microtask — after the click dispatches and `handleItemSelected` reads it, but before
   * any later keyboard activation, which must not see a stale flag.
   */
  private readonly onPointerActivate = (): void => {
    this.pointerActivation = true;
    queueMicrotask(() => {
      this.pointerActivation = false;
    });
  };

  /**
   * Moves focus in: the first item for keyboard invocations, the menu element itself for
   * pointer ones, so nothing starts highlighted as with native context menus.
   */
  private applyInitialFocus(): void {
    const pane = this.popoverRef?.overlayElement;
    if (!pane) {
      return;
    }
    if (this.focusFirstOnOpen) {
      const item =
        pane.querySelector<HTMLElement>(MENU_ROW_TABBABLE) ??
        pane.querySelector<HTMLElement>(MENU_ROW);
      item?.focus();
    } else {
      // Clearing the default active item makes ArrowDown land on item one, ArrowUp on the last.
      this.deps.panel()?.clearActiveItem();
      pane.querySelector<HTMLElement>('[role="menu"]')?.focus();
    }
  }

  /**
   * The aria menu renders items through deferred content one render after attach, so keep
   * trying after each render until a menuitem exists to focus.
   */
  private scheduleInitialFocus(): void {
    this.initialFocusRef?.destroy();
    const openedRef = this.popoverRef;
    if (!openedRef) {
      return;
    }
    this.initialFocusRef = afterEveryRender(
      {
        write: () => {
          if (this.popoverRef !== openedRef || openedRef.closed) {
            this.initialFocusRef?.destroy();
            return;
          }
          if (openedRef.overlayElement.querySelector(MENU_ROW)) {
            // The pane was positioned while empty, so re-run the flip at its real size
            // before focusing, or focus scrolls to a stale spot.
            openedRef.updatePosition();
            this.applyInitialFocus();
            this.initialFocusRef?.destroy();
          }
        },
      },
      { injector: this.deps.injector },
    );
  }

  private restoreFocus(): void {
    const element = this.restoreFocusElement;
    if (element instanceof HTMLElement && element.isConnected) {
      element.focus();
    }
  }
}
