import { DOCUMENT, Injectable, inject } from '@angular/core';

import type {
  DrawerHandoffPass,
  DrawerToolbarMark,
  TimedDrawerHandoffPass,
} from './drawer-handoff.types';
import type { DrawerSwapDirection } from './drawer.types';

/** How long a handoff waits for the next drawer to open. A route change opens it in one frame. */
const HANDOFF_WINDOW_MS = 1000;

/**
 * Lets one drawer take the place of another without the exit and the entrance, so the two read
 * as one panel whose content changed. The leaving panel skips its own exit and calls
 * {@link pass}. The next drawer to open then appears at once, and its content comes in from the
 * side the direction names. A toolbar button drawn the same in the same place stays still.
 *
 * ```ts
 * // In the leaving panel's guard, when the next route shows another panel of the same page:
 * inject(DrawerHandoff).pass('forward');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DrawerHandoff {
  private readonly document = inject(DOCUMENT);
  private passed: TimedDrawerHandoffPass | null = null;

  /**
   * The next drawer to open takes the place of one that leaves without its exit. Call it while the
   * leaving drawer is still on screen: it reads where that drawer's toolbar buttons are.
   */
  pass(direction: DrawerSwapDirection = 'none'): void {
    const toolbar = toolbarButtons(this.document.querySelectorAll('dialog.drawer[open]'));
    this.passed = { at: Date.now(), direction, toolbar: toolbar.map(toolbarMark) };
  }

  /**
   * The passed place the opening drawer takes, or `null`. It clears the handoff. A pass that no
   * drawer took in time is dropped, so a later open still plays its entrance.
   */
  take(): DrawerHandoffPass | null {
    const passed = this.passed;
    this.passed = null;
    return passed !== null && Date.now() - passed.at < HANDOFF_WINDOW_MS ? passed : null;
  }
}

/** The toolbar buttons on screen. The toolbar's hidden measuring row is not on screen. */
export function toolbarButtons(drawers: Iterable<Element>): HTMLElement[] {
  return [...drawers].flatMap((drawer) =>
    [...drawer.querySelectorAll<HTMLElement>('.drawer-toolbar :is(button, a)')].filter(
      (button) =>
        button.closest('[aria-hidden="true"]') === null && button.getBoundingClientRect().width > 0,
    ),
  );
}

export function toolbarMark(button: HTMLElement): DrawerToolbarMark {
  const rect = button.getBoundingClientRect();
  return {
    label: (button.getAttribute('aria-label') ?? button.textContent).trim(),
    left: Math.round(rect.left),
    width: Math.round(rect.width),
  };
}

/** Whether a button is drawn the same in the same place as one of the marks, to a pixel. */
export function keepsPlace(mark: DrawerToolbarMark, marks: readonly DrawerToolbarMark[]): boolean {
  return marks.some(
    (other) =>
      other.label === mark.label &&
      Math.abs(other.left - mark.left) <= 1 &&
      Math.abs(other.width - mark.width) <= 1,
  );
}
