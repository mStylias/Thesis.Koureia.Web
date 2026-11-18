import { ConnectedPosition } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  contentChild,
  inject,
  Injector,
  input,
  OnDestroy,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { PopoverAnchor, PopoverService } from '@ui/popover';
import { MenuOverlayController } from './menu-overlay-controller';
import { MenuPanel } from './menu-panel';
import { MenuItemTemplate } from './menu-templates';
import { MenuDensity, MenuItem } from './menu.types';

let nextMenuTriggerId = 0;

/** Dropdown placement: below the trigger, aligned to its start, flipping. */
const DROPDOWN_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Design-system menu: a button-triggered dropdown on the shared `@ui/menu` panel, opened
 * through the `@ui/popover` primitive.
 *
 * ```ts
 * import { Menu, MenuTrigger } from '@ui/menu';
 * ```
 *
 * ```html
 * <button libButton [libMenuTriggerFor]="menu">Actions</button>
 * <lib-menu #menu [items]="items" />
 * ```
 *
 * Typed `MenuItem` entries support icons, separators, headings, `command` callbacks,
 * `routerLink`/`url` navigation and nested submenus — the same capability as `ContextMenu`,
 * which shares this panel and engine. Custom rows via `libMenuItem`. The trigger opens on
 * Enter/Space/ArrowDown with the first item highlighted; the rest is the WAI-ARIA pattern.
 */
@Component({
  selector: 'lib-menu',
  imports: [MenuPanel],
  template: `
    <ng-template #panelTemplate>
      <lib-menu-panel
        [items]="items()"
        [itemTemplate]="itemTemplate()?.templateRef"
        [ariaLabel]="ariaLabel()"
        [menuId]="menuId"
        [density]="density()"
        (itemSelected)="controller.handleItemSelected($event)"
      />
    </ng-template>
  `,
})
export class Menu implements OnDestroy {
  private readonly popover = inject(PopoverService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router, { optional: true });

  /** Entries of the menu; `items` on an entry create submenus. */
  readonly items = input<readonly MenuItem[]>([]);

  /** Accessible name of the menu. */
  readonly ariaLabel = input('');

  /**
   * Row height and text size. `compact` suits a menu that answers one control
   * rather than a list of commands. Submenus follow it.
   */
  readonly density = input<MenuDensity>('standard');

  /** Emits after the menu opens. */
  readonly opened = output();

  /** Emits after the menu starts closing, whatever the reason. */
  readonly closed = output();

  /** Id of the `menu` element, for the trigger's `aria-controls`. */
  readonly menuId = `lib-menu-panel-${nextMenuTriggerId++}`;

  protected readonly itemTemplate = contentChild(MenuItemTemplate);
  protected readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panelTemplate');
  private readonly panel = viewChild(MenuPanel);

  private readonly openState = signal(false);

  /** Whether the menu is currently open. */
  readonly isOpen = this.openState.asReadonly();

  protected readonly controller = new MenuOverlayController({
    popover: this.popover,
    document: this.document,
    router: this.router,
    injector: this.injector,
    viewContainerRef: this.viewContainerRef,
    panelTemplate: () => this.panelTemplate(),
    panel: () => this.panel(),
    onOpened: () => {
      this.openState.set(true);
      this.opened.emit();
    },
    onClosed: () => {
      this.openState.set(false);
      this.closed.emit();
    },
  });

  ngOnDestroy(): void {
    this.controller.destroy();
  }

  /**
   * Opens anchored to `anchor`, or re-anchors if open. `focusFirstItem` highlights the
   * first item — for keyboard invocations, not pointer ones.
   */
  openFor(anchor: PopoverAnchor, options: { focusFirstItem: boolean; triggerEvent?: Event }): void {
    this.controller.open({
      anchor,
      positions: DROPDOWN_POSITIONS,
      focusFirstItem: options.focusFirstItem,
      triggerEvent: options.triggerEvent,
    });
  }

  /** Opens the menu if closed, closes it if open. */
  toggleFor(
    anchor: PopoverAnchor,
    options: { focusFirstItem: boolean; triggerEvent?: Event },
  ): void {
    if (this.controller.isOpen) {
      this.close();
    } else {
      this.openFor(anchor, options);
    }
  }

  /** Closes the menu. */
  close(): void {
    this.controller.close();
  }
}
