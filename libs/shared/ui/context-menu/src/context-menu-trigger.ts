import { booleanAttribute, Directive, input, OnDestroy } from '@angular/core';
import { ContextMenu } from './context-menu';

/** Movement past this many pixels cancels a touch long-press. */
const PRESS_MOVE_TOLERANCE_PX = 10;

/** How long a touch must hold still to count as a long-press. */
const PRESS_DELAY_MS = 500;

/**
 * How long after a long-press the native `contextmenu` event is
 * swallowed, so platforms that fire it for long-presses (Android)
 * don't re-open the menu the directive just opened.
 */
const PRESS_SUPPRESS_MS = 700;

/**
 * Attaches a `lib-context-menu` to an element:
 *
 * ```html
 * <div [libContextMenu]="menu">Right-click me</div>
 * <lib-context-menu #menu [items]="items" />
 * ```
 *
 * Opens on right-click, on Shift+F10 / the ContextMenu key (browsers
 * deliver both as `contextmenu` events), and on touch long-press for
 * platforms that don't synthesise `contextmenu` for touch (iOS).
 */
@Directive({
  selector: '[libContextMenu]',
  host: {
    // Withheld while disabled: advertising a menu the element will not open
    // is the same defect as leaving an edit affordance on a read-only control.
    '[attr.aria-haspopup]': 'contextMenuDisabled() ? null : "menu"',
    '(contextmenu)': 'onContextMenu($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'cancelPress()',
    '(pointercancel)': 'cancelPress()',
  },
})
export class ContextMenuTrigger implements OnDestroy {
  /** The menu this element opens. */
  readonly libContextMenu = input.required<ContextMenu>();

  /** Disables the trigger without removing it. */
  readonly contextMenuDisabled = input(false, {
    transform: booleanAttribute,
  });

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private pressStart: { x: number; y: number } | null = null;
  private suppressNativeUntil = 0;

  ngOnDestroy(): void {
    this.cancelPress();
  }

  protected onContextMenu(event: MouseEvent): void {
    if (this.contextMenuDisabled()) {
      return;
    }
    if (Date.now() < this.suppressNativeUntil) {
      event.preventDefault();
      return;
    }
    this.cancelPress();
    this.libContextMenu().show(event);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch' || this.contextMenuDisabled()) {
      return;
    }
    this.pressStart = { x: event.clientX, y: event.clientY };
    this.pressTimer = setTimeout(() => {
      const start = this.pressStart;
      this.cancelPress();
      if (start) {
        this.suppressNativeUntil = Date.now() + PRESS_SUPPRESS_MS;
        this.libContextMenu().showAt(start);
      }
    }, PRESS_DELAY_MS);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pressStart) {
      return;
    }
    const dx = event.clientX - this.pressStart.x;
    const dy = event.clientY - this.pressStart.y;
    if (Math.hypot(dx, dy) > PRESS_MOVE_TOLERANCE_PX) {
      this.cancelPress();
    }
  }

  protected cancelPress(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
    this.pressStart = null;
  }
}
