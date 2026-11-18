import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  PLATFORM_ID,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  computed,
  contentChild,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { LucideGripHorizontal, LucideX } from '@lucide/angular';
import { Button } from '@ui/button';
import { UiCopyPipe } from '@util/ui-copy';

import { PANEL_EDGES, clampRect, moveRect, resizeRect } from './core/floating-panel-geometry';
import type { PanelEdge, PanelRect, PanelSize } from './core/floating-panel-geometry.types';

/** How far one arrow key press moves or resizes the panel, in CSS pixels. */
const KEYBOARD_STEP = 16;

/** What a pointer press on these starts instead of a move. The grip is the exception. */
const NOT_A_HANDLE = 'button:not([data-fp-grip]), a, input, select, textarea';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let nextPanelId = 0;

/** Marks the `ng-template` the panel renders as its body. It renders only while open. */
@Directive({ selector: 'ng-template[libFloatingPanelContent]' })
export class FloatingPanelContent {
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * A non-modal panel that floats over the page.
 *
 * It opens docked to the bottom-right corner and runs the full height of its
 * bounds. The user drags it by the header and resizes it from any edge or
 * corner. The page under it stays usable, so it suits a tool the user works
 * with while watching the page react.
 *
 * ```ts
 * import { FloatingPanel, FloatingPanelContent } from '@ui/floating-panel';
 * ```
 *
 * ```html
 * <lib-floating-panel [(open)]="open" header="Columns" insetTop="var(--shell-header-height)">
 *   <ng-template libFloatingPanelContent>…</ng-template>
 * </lib-floating-panel>
 * ```
 */
@Component({
  selector: 'lib-floating-panel',
  templateUrl: './floating-panel.html',
  styleUrl: './floating-panel.scss',
  imports: [NgTemplateOutlet, Button, LucideGripHorizontal, LucideX, TranslocoPipe, UiCopyPipe],
  // View-only: the body template is the consumer's, and must keep the consumer's scope.
  viewProviders: [
    provideTranslocoScope({
      scope: 'floatingPanel',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
})
export class FloatingPanel {
  /** Two-way visibility. */
  readonly open = model(false);

  /** Text of the heading, which also names the panel. */
  readonly header = input('');

  /** Id of the panel element, for a trigger's `aria-controls`. Generated when empty. */
  readonly panelId = input('');

  /**
   * Space kept free above the panel, as a CSS length, such as an app bar's
   * height. The panel stops a gutter below it.
   */
  readonly insetTop = input('');

  /**
   * An element the docked panel opens below, such as the toolbar that holds
   * its trigger, so the panel never covers it. A drag can still take the
   * panel above it, up to `insetTop`.
   */
  readonly dockBelow = input<HTMLElement | null>(null);

  /** Accessible name of the close button. Falls back to the translation. */
  readonly closeAriaLabel = input('');

  /** Accessible name of the move grip. Falls back to the translation. */
  readonly moveAriaLabel = input('');

  protected readonly content = contentChild(FloatingPanelContent);
  protected readonly edges = PANEL_EDGES;

  private readonly generatedId = `lib-floating-panel-${(nextPanelId++).toString()}`;
  protected readonly id = computed(() => this.panelId() || this.generatedId);
  protected readonly titleId = `${this.generatedId}-title`;
  protected readonly hintId = `${this.generatedId}-hint`;

  /** The user's own placement. `null` is the docked default, which CSS draws. */
  protected readonly rect = signal<PanelRect | null>(null);
  /** The bottom of `dockBelow` in viewport pixels, read on open. */
  protected readonly dockTop = signal<number | null>(null);
  protected readonly moving = signal(false);

  private readonly surface = viewChild.required<TemplateRef<unknown>>('surface');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly bounds = viewChild<ElementRef<HTMLElement>>('bounds');

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private overlayRef: OverlayRef | null = null;
  private returnFocusTo: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      untracked(() => {
        if (!this.isBrowser) {
          return;
        }
        const active = this.document.activeElement;
        this.returnFocusTo = active instanceof HTMLElement ? active : null;
        this.measureDock();
        this.attach();
        afterNextRender(
          () => {
            this.focusFirst();
          },
          { injector: this.injector },
        );
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.document.defaultView?.removeEventListener('resize', this.onViewportResize);
      this.overlayRef?.dispose();
      this.overlayRef = null;
    });
  }

  /** Closes the panel and gives focus back to what held it before the open. */
  close(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    const target = this.returnFocusTo;
    this.returnFocusTo = null;
    if (target?.isConnected) {
      target.focus();
    }
  }

  /** Docks the panel back to its default place and size. */
  resetPlacement(): void {
    this.measureDock();
    this.rect.set(null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    // A non-modal panel can sit inside another surface, which must keep its own Escape.
    event.stopPropagation();
    this.close();
  }

  protected onMoveStart(event: PointerEvent): void {
    if (event.button !== 0 || (event.target as Element).closest(NOT_A_HANDLE)) {
      return;
    }
    const geometry = this.measure();
    if (geometry == null) {
      return;
    }
    this.track(event, (dx, dy) => {
      this.rect.set(moveRect(geometry.start, dx, dy, geometry.bounds, geometry.min));
    });
  }

  protected onResizeStart(event: PointerEvent, edge: PanelEdge): void {
    if (event.button !== 0) {
      return;
    }
    const geometry = this.measure();
    if (geometry == null) {
      return;
    }
    this.track(event, (dx, dy) => {
      this.rect.set(resizeRect(geometry.start, edge, dx, dy, geometry.bounds, geometry.min));
    });
  }

  /** Arrow keys move the panel. With Shift they move its right or bottom edge. */
  protected onGripKeydown(event: KeyboardEvent): void {
    const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const dy = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (dx === 0 && dy === 0) {
      return;
    }
    const geometry = this.measure();
    if (geometry == null) {
      return;
    }
    event.preventDefault();
    const { start, bounds, min } = geometry;
    const [stepX, stepY] = [dx * KEYBOARD_STEP, dy * KEYBOARD_STEP];
    this.rect.set(
      event.shiftKey
        ? resizeRect(start, dx === 0 ? 's' : 'e', stepX, stepY, bounds, min)
        : moveRect(start, stepX, stepY, bounds, min),
    );
  }

  protected onHeaderDoubleClick(event: MouseEvent): void {
    if (!(event.target as Element).closest(NOT_A_HANDLE)) {
      this.resetPlacement();
    }
  }

  /** Created on the first open and kept, so a reopen lands where the user left it. */
  private attach(): void {
    if (this.overlayRef != null) {
      return;
    }
    // No position strategy: the panel places itself with `position: fixed`. The overlay only
    // lifts it out of the page's stacking contexts, which a grid or a sticky region can create.
    this.overlayRef = this.overlay.create({
      usePopover: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
    });
    this.overlayRef.attach(new TemplatePortal(this.surface(), this.viewContainerRef));
    this.document.defaultView?.addEventListener('resize', this.onViewportResize);
  }

  private measureDock(): void {
    const anchor = this.dockBelow();
    this.dockTop.set(anchor?.isConnected ? anchor.getBoundingClientRect().bottom : null);
  }

  private focusFirst(): void {
    const panel = this.panel()?.nativeElement;
    if (panel == null) {
      return;
    }
    const first = panel.querySelector<HTMLElement>(`.fp-body :is(${FOCUSABLE})`);
    (first ?? panel).focus();
  }

  /** The panel's box, its bounds and its floor, read once when a gesture starts. */
  private measure(): { start: PanelRect; bounds: PanelRect; min: PanelSize } | null {
    const panel = this.panel()?.nativeElement;
    const bounds = this.bounds()?.nativeElement;
    const view = this.document.defaultView;
    if (panel == null || bounds == null || view == null) {
      return null;
    }
    const style = view.getComputedStyle(panel);
    return {
      start: this.rect() ?? toRect(panel.getBoundingClientRect()),
      bounds: toRect(bounds.getBoundingClientRect()),
      min: {
        width: parseFloat(style.minWidth) || 0,
        height: parseFloat(style.minHeight) || 0,
      },
    };
  }

  /** Follows one pointer until it lets go. Capture keeps the moves coming off the panel. */
  private track(event: PointerEvent, apply: (dx: number, dy: number) => void): void {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const { clientX, clientY, pointerId } = event;
    handle.setPointerCapture(pointerId);
    this.moving.set(true);

    const move = (moveEvent: PointerEvent): void => {
      apply(moveEvent.clientX - clientX, moveEvent.clientY - clientY);
    };
    const end = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      this.moving.set(false);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /** A docked panel follows its anchor. A placed panel is pulled back inside. */
  private readonly onViewportResize = (): void => {
    if (this.rect() == null) {
      this.measureDock();
      return;
    }
    const geometry = this.measure();
    if (geometry != null) {
      this.rect.set(clampRect(geometry.start, geometry.bounds, geometry.min));
    }
  };
}

function toRect(box: DOMRect): PanelRect {
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}
