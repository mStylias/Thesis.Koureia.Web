import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';

import { acquireScrollLock, releaseScrollLock } from './page-scroll-lock';

let nextUniqueId = 0;

/** Pointer travel, in px, past which a grab is a drag and not a tap. */
const DRAG_THRESHOLD = 8;

/** How far the sheet must be dragged before the release changes its state. */
const COMMIT_DISTANCE = 56;

/**
 * A sheet pinned to the bottom edge that is never absent: collapsed it shows a
 * peek bar, expanded it shows the full content over a backdrop.
 *
 * ```ts
 * import { BottomSheet } from '@ui/bottom-sheet';
 * ```
 *
 * ```html
 * <lib-bottom-sheet [(expanded)]="open" [toggleLabel]="label()">
 *   <div libBottomSheetPeek>one line, always on screen</div>
 *   <div libBottomSheetActions>the actions, also always on screen</div>
 *   <p>the detail, revealed when expanded</p>
 * </lib-bottom-sheet>
 * ```
 *
 * Four slots: `[libBottomSheetPeek]` is the bar's content and is always visible,
 * `[libBottomSheetTrailing]` is a control at the end of the bar (the one place a
 * control reaches, since the toggle covers the rest), `[libBottomSheetActions]` is
 * visible in both states — under the bar while collapsed, the sheet's footer while
 * expanded — and the default slot is the panel, which is `inert` while collapsed so
 * a keyboard user never tabs into content they cannot see.
 *
 * `[collapsible]="false"` pins it open: no toggle, no scrim, no `Escape`, no drag.
 *
 * A consumer that uses the actions slot **must declare its height** with
 * `--bottom-sheet-actions-height`, which the collapsed travel reads.
 *
 * **This is not `@ui/drawer` with a different edge.** A drawer is binary — hidden
 * or shown — and has no state in which it occupies the page while closed. Consumers
 * that need a dismissible overlay panel should still use the drawer.
 *
 * It expands by tap anywhere on the bar and by drag, and it moves by `transform`
 * alone, so the global reduced-motion rule collapses the travel while the state
 * still changes. The bar paints no chevron: the grip above it is the affordance.
 *
 * The bar's height is `--bottom-sheet-peek-height`, and the band on screen while
 * collapsed is that plus `--bottom-sheet-actions-height`. **Page content must reserve
 * that much bottom padding**, or the sheet covers whatever sits at the end of the page.
 */
@Component({
  selector: 'lib-bottom-sheet',
  imports: [TranslocoPipe, UiCopyPipe],
  providers: [
    provideTranslocoScope({
      scope: 'bottomSheet',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  templateUrl: './bottom-sheet.html',
  styleUrl: './bottom-sheet.scss',
  host: {
    '[attr.data-expanded]': 'expanded() ? "" : null',
    '[attr.data-dragging]': 'dragging() ? "" : null',
    '[attr.data-locked]': 'collapsible() ? null : ""',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class BottomSheet {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  // Optional: a sheet that cannot collapse renders no toggle.
  private readonly toggle = viewChild<ElementRef<HTMLElement>>('toggle');
  private readonly actions = viewChild.required<ElementRef<HTMLElement>>('actions');

  /** Which state the sheet is in. Two-way, so a drag or a tap writes back. */
  readonly expanded = model(false);

  /**
   * Names the toggle. Keep it stable across both states — the button holds focus
   * through the press, and a name that flips there is re-announced mid-interaction.
   * `aria-expanded` already carries the state.
   */
  readonly toggleLabel = input('');

  /** Locks page scrolling while expanded. Off for a sheet that is page furniture. */
  readonly lockScroll = input(true);

  /**
   * Whether the customer may close it. `false` pins the sheet open: no toggle, no scrim, no
   * `Escape`, no drag. For a screen whose whole content is the sheet, where collapsing would
   * leave nothing behind it.
   *
   * The consumer still owns `expanded` and must set it, because pinning a collapsed sheet
   * open is not this input's job.
   */
  readonly collapsible = input(true);

  protected readonly panelId = `lib-bottom-sheet-panel-${nextUniqueId++}`;

  /** Drag state. Plain fields: nothing renders from them except the inline offset. */
  private pointerId: number | null = null;
  private startY = 0;
  private lastOffset = 0;
  private moved = false;
  /** How far the sheet can travel, measured once per grab. `Infinity` where there is no layout. */
  private travel = Number.POSITIVE_INFINITY;

  private readonly draggingState = signal(false);
  protected readonly dragging = this.draggingState.asReadonly();

  protected readonly inertPanel = computed(() => (this.expanded() ? null : ''));

  constructor() {
    effect((onCleanup) => {
      if (!this.isBrowser || !this.expanded() || !this.lockScroll()) return;

      acquireScrollLock(this.document);
      onCleanup(() => {
        releaseScrollLock(this.document);
      });
    });

    // Focus follows the state: into the panel when it becomes readable, back to the
    // bar when it goes inert, so focus is never left on something now unreachable.
    let wasExpanded = false;
    effect(() => {
      const open = this.expanded();
      if (!this.isBrowser || open === wasExpanded) return;

      wasExpanded = open;
      const target = open ? this.panel() : this.toggle();
      target?.nativeElement.focus({ preventScroll: true });
    });
  }

  /**
   * The distance between the two resting places: the surface less the band the collapsed
   * sheet leaves on screen.
   *
   * `Infinity` when nothing has been laid out, which is jsdom and a server render. Clamping
   * to a measurement of zero would pin the sheet in place.
   */
  private measureTravel(): number {
    const band =
      this.header().nativeElement.offsetHeight + this.actions().nativeElement.offsetHeight;
    const distance = this.surface().nativeElement.offsetHeight - band;
    return distance > 0 ? distance : Number.POSITIVE_INFINITY;
  }

  protected collapse(): void {
    this.expanded.set(false);
  }

  protected onToggleClick(): void {
    // A drag ends with a click on the same button. The state was already decided
    // on release, so acting again would undo it.
    if (this.moved) {
      this.moved = false;
      return;
    }
    this.expanded.update((open) => !open);
  }

  protected onEscape(event: Event): void {
    if (!this.expanded() || !this.collapsible()) return;

    // Stopped only while expanded, so the key still reaches an enclosing dialog
    // when the sheet has nothing to close.
    event.stopPropagation();
    this.collapse();
  }

  protected onGrabStart(event: PointerEvent): void {
    if (!this.isBrowser || !this.collapsible()) return;
    if (this.pointerId !== null || event.button !== 0) return;

    this.pointerId = event.pointerId;
    this.startY = event.clientY;
    this.lastOffset = 0;
    this.moved = false;
    this.travel = this.measureTravel();

    const surface = this.surface().nativeElement;
    surface.setPointerCapture(event.pointerId);
    surface.addEventListener('pointermove', this.onGrabMove);
    surface.addEventListener('pointerup', this.onGrabEnd);
    surface.addEventListener('pointercancel', this.onGrabEnd);
  }

  private readonly onGrabMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;

    const delta = event.clientY - this.startY;
    if (!this.moved && Math.abs(delta) < DRAG_THRESHOLD) return;

    if (!this.moved) {
      this.moved = true;
      this.draggingState.set(true);
    }

    // Clamped to the one direction that has anywhere to go, and to how far that is:
    // an expanded sheet only travels down, a collapsed one only up, and neither goes
    // past the other's resting place. Without the second half of that a drag up lifts
    // the sheet off the edge it is pinned to and opens a gap under it.
    this.lastOffset = this.expanded()
      ? Math.min(this.travel, Math.max(0, delta))
      : Math.max(-this.travel, Math.min(0, delta));
    this.surface().nativeElement.style.setProperty('--drag', `${this.lastOffset}px`);
  };

  private readonly onGrabEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;

    const surface = this.surface().nativeElement;
    surface.removeEventListener('pointermove', this.onGrabMove);
    surface.removeEventListener('pointerup', this.onGrabEnd);
    surface.removeEventListener('pointercancel', this.onGrabEnd);
    if (surface.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }

    this.pointerId = null;
    surface.style.removeProperty('--drag');
    this.draggingState.set(false);

    if (!this.moved) return;

    if (Math.abs(this.lastOffset) >= COMMIT_DISTANCE) {
      this.expanded.set(this.lastOffset < 0);
    }
    // `moved` is cleared by the click that follows, which is the one this drag
    // must not be read as.
  };
}
