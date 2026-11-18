import { booleanAttribute, Directive, ElementRef, inject, input } from '@angular/core';
import { Menu } from './menu';

/**
 * Attaches a `lib-menu` dropdown to a trigger element:
 *
 * ```html
 * <button libButton [libMenuTriggerFor]="menu">Actions</button>
 * <lib-menu #menu [items]="items" />
 * ```
 *
 * Click toggles the menu (opened without a highlighted item); Enter,
 * Space, ArrowDown, and ArrowUp open it with the first item highlighted
 * for keyboard navigation. Carries `aria-haspopup`, `aria-expanded`, and
 * `aria-controls`.
 *
 * `menuDisabled` blocks every activation and marks the trigger
 * `aria-disabled`.
 */
@Directive({
  selector: '[libMenuTriggerFor]',
  exportAs: 'libMenuTrigger',
  host: {
    // `aria-haspopup` and `aria-expanded` stay put while disabled — they
    // describe what the control *is*, and a disabled control keeps its
    // identity. What was missing is the state itself: `menuDisabled` used
    // to swallow every activation while announcing nothing, so the trigger
    // read as operable and simply did nothing.
    'aria-haspopup': 'menu',
    '[attr.aria-disabled]': 'menuDisabled() ? "true" : null',
    '[attr.aria-expanded]': 'libMenuTriggerFor().isOpen()',
    '[attr.aria-controls]': 'libMenuTriggerFor().isOpen() ? libMenuTriggerFor().menuId : null',
    '(pointerdown)': 'onPointerDown()',
    '(click)': 'onClick()',
    '(keydown.enter)': 'onKeydownOpen($event)',
    '(keydown.space)': 'onKeydownOpen($event)',
    '(keydown.arrowDown)': 'onKeydownOpen($event)',
    '(keydown.arrowUp)': 'onKeydownOpen($event)',
  },
})
export class MenuTrigger {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The menu this element opens. */
  readonly libMenuTriggerFor = input.required<Menu>();

  /**
   * Disables the trigger without removing it.
   *
   * This only governs the menu behaviour; it does not disable the host
   * element. On a `<button>` or `libButton` host, pass that element's own
   * `disabled` too so it also leaves the tab order. Note that a native
   * `disabled` button never fires the events this directive listens for,
   * which is why the guards below stay independent of it.
   */
  readonly menuDisabled = input(false, { transform: booleanAttribute });

  // Whether the menu was open when the pointer went down. Clicking an
  // open trigger triggers the overlay's outside-dismiss (which closes)
  // *before* this click handler runs, so without this snapshot the
  // handler would see a closed menu and immediately reopen it.
  private wasOpenOnPointerDown = false;

  protected onPointerDown(): void {
    this.wasOpenOnPointerDown = this.libMenuTriggerFor().isOpen();
  }

  protected onClick(): void {
    const wasOpen = this.wasOpenOnPointerDown;
    this.wasOpenOnPointerDown = false;
    if (this.menuDisabled()) {
      return;
    }
    if (wasOpen) {
      this.libMenuTriggerFor().close();
      return;
    }
    // Pointer open: no item highlighted, like native menus.
    this.libMenuTriggerFor().openFor(this.elementRef, {
      focusFirstItem: false,
    });
  }

  protected onKeydownOpen(event: Event): void {
    if (this.menuDisabled()) {
      return;
    }
    // Keyboard open highlights the first item; suppress the key's
    // default (page scroll on the arrows, click synthesis on Enter).
    event.preventDefault();
    this.libMenuTriggerFor().openFor(this.elementRef, {
      focusFirstItem: true,
      triggerEvent: event,
    });
  }
}
