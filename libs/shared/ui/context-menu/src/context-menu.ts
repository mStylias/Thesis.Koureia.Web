import { DOCUMENT } from '@angular/common';
import { ConnectedPosition } from '@angular/cdk/overlay';
import {
  booleanAttribute,
  Component,
  contentChild,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  output,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  MenuDensity,
  MenuItem,
  MenuItemTemplate,
  MenuOverlayController,
  MenuPanel,
} from '@ui/menu';
import { PopoverAnchor, PopoverService } from '@ui/popover';

/**
 * Below-right of the cursor, the native convention, flipping corner by corner when the
 * viewport runs out. For a `Point` origin the `origin*` values collapse onto the point.
 */
const POINT_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];

/** Keyboard invocations carry no coordinates, so anchor to the element, dropdown-style. */
const ELEMENT_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Design-system context menu: the `@ui/menu` panel rendered through `@ui/popover` at the
 * pointer position.
 *
 * ```ts
 * import { ContextMenu, ContextMenuTrigger } from '@ui/context-menu';
 * ```
 *
 * ```html
 * <img [libContextMenu]="menu" src="…" alt="…" />
 * <lib-context-menu #menu [items]="items" />
 * ```
 *
 * Items are typed `MenuItem` objects supporting icons, separators,
 * group headings, `command` callbacks, `routerLink`/`queryParams`
 * navigation, external `url`s, and nested `items` submenus. Custom rows
 * via `libMenuItem`:
 *
 * ```html
 * <lib-context-menu [items]="items">
 *   <ng-template libMenuItem let-item>… {{ item.label }} …</ng-template>
 * </lib-context-menu>
 * ```
 *
 * With `global` the menu attaches to the document instead of a trigger. Keyboard support
 * follows the WAI-ARIA menu pattern; Shift+F10 anchors to the target element, having no
 * pointer coordinates. The engine is the shared `MenuOverlayController`, so behaviour
 * matches the dropdown `Menu`.
 */
@Component({
  selector: 'lib-context-menu',
  imports: [MenuPanel],
  template: `
    <ng-template #panelTemplate>
      <lib-menu-panel
        [items]="items()"
        [itemTemplate]="itemTemplate()?.templateRef"
        [ariaLabel]="ariaLabel()"
        [density]="density()"
        (itemSelected)="controller.handleItemSelected($event)"
      />
    </ng-template>
  `,
})
export class ContextMenu implements OnDestroy {
  private readonly popover = inject(PopoverService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router, { optional: true });

  /** Entries of the menu; `items` on an entry create submenus. */
  readonly items = input<readonly MenuItem[]>([]);

  /** Attaches to the whole document: right-click anywhere, no trigger directive. */
  readonly global = input(false, { transform: booleanAttribute });

  /** Accessible name of the menu. */
  readonly ariaLabel = input('');

  /**
   * Row height and text size. `compact` suits a menu that answers one control
   * — a grid column's options, a filter's operation — rather than a list of
   * commands. Submenus follow it.
   */
  readonly density = input<MenuDensity>('standard');

  /** Emits after the menu opens. */
  readonly opened = output();

  /** Emits after the menu starts closing, whatever the reason. */
  readonly closed = output();

  protected readonly itemTemplate = contentChild(MenuItemTemplate);
  protected readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panelTemplate');
  private readonly panel = viewChild(MenuPanel);

  protected readonly controller = new MenuOverlayController({
    popover: this.popover,
    document: this.document,
    router: this.router,
    injector: this.injector,
    viewContainerRef: this.viewContainerRef,
    panelTemplate: () => this.panelTemplate(),
    panel: () => this.panel(),
    onOpened: () => {
      this.opened.emit();
    },
    onClosed: () => {
      this.closed.emit();
    },
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.global()) {
        return;
      }
      const listener = (event: MouseEvent): void => {
        this.show(event);
      };
      this.document.addEventListener('contextmenu', listener);
      onCleanup(() => {
        this.document.removeEventListener('contextmenu', listener);
      });
    });
  }

  ngOnDestroy(): void {
    this.controller.destroy();
  }

  /**
   * Opens for a `contextmenu` event: at the pointer, or anchored to the target for
   * keyboard invocations, which carry no usable coordinates.
   */
  show(event: MouseEvent): void {
    // A right-click on the open menu must not spawn a browser menu or re-anchor this one.
    if (event.target instanceof Node && this.controller.overlayElement?.contains(event.target)) {
      event.preventDefault();
      return;
    }

    const target =
      event.currentTarget instanceof Element
        ? event.currentTarget
        : event.target instanceof Element
          ? event.target
          : null;
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;

    event.preventDefault();
    event.stopPropagation();

    // Keyboard users need the first item highlighted; pointer users get none, as native.
    this.showAt(fromKeyboard && target ? target : { x: event.clientX, y: event.clientY }, event, {
      focusFirstItem: fromKeyboard,
    });
  }

  /**
   * Opens at an explicit anchor, element or viewport point — the trigger directive uses
   * this for touch long-presses. Focus lands on the menu; `focusFirstItem` highlights the
   * first item, as keyboard invocations want.
   */
  showAt(
    anchor: PopoverAnchor,
    triggerEvent?: Event,
    options?: { focusFirstItem?: boolean },
  ): void {
    const isElement = anchor instanceof Element || anchor instanceof ElementRef;
    this.controller.open({
      anchor,
      positions: isElement ? ELEMENT_POSITIONS : POINT_POSITIONS,
      focusFirstItem: options?.focusFirstItem ?? false,
      triggerEvent,
    });
  }

  /** Closes the menu without restoring focus. */
  hide(): void {
    this.controller.close();
  }
}
