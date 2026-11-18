import { ConnectedPosition, FlexibleConnectedPositionStrategyOrigin } from '@angular/cdk/overlay';
import { Injector, TemplateRef, ViewContainerRef } from '@angular/core';

/**
 * What the popover is positioned against: an element (dropdowns,
 * tooltips) or a viewport point such as the pointer coordinates of a
 * `contextmenu` event.
 */
export type PopoverAnchor = FlexibleConnectedPositionStrategyOrigin;

/** Why a popover closed. `programmatic` means `PopoverRef.close()`. */
export type PopoverCloseReason = 'programmatic' | 'outside' | 'escape' | 'scroll';

/** Options common to every popover, independent of what it renders. */
export interface PopoverBaseConfig {
  /** Element or `{x, y}` viewport point the popover attaches to. */
  anchor: PopoverAnchor;

  /**
   * Preferred position first, fallbacks after — the overlay flips to
   * the first entry that fits and pushes on-screen as a last resort.
   */
  positions: readonly ConnectedPosition[];

  /**
   * What scrolling does while open. `reposition` (default) keeps the
   * popover glued to its anchor; `close` dismisses it, which is the
   * safe choice for point-anchored surfaces whose anchor scrolls away.
   */
  scrollBehavior?: 'reposition' | 'close';

  /** Close on pointerdown outside the pane. Defaults to `true`. */
  dismissOnOutsidePointer?: boolean;

  /** Close on Escape (captured on the pane). Defaults to `true`. */
  dismissOnEscape?: boolean;

  /** Extra class(es) for the `cdk-overlay-pane` element. */
  panelClass?: string | string[];

  /**
   * Awaited before the overlay is torn down on `close()` — the hook
   * for exit animations. Not awaited for `scroll` dismissals, which
   * dispose immediately.
   */
  beforeDispose?: () => Promise<void>;

  /**
   * Called exactly once when the popover starts closing, whatever the
   * trigger (dismissal or `close()`).
   */
  onClose?: (reason: PopoverCloseReason) => void;
}

/** Config for `PopoverService.open`, which renders a template. */
export interface PopoverConfig<C = unknown> extends PopoverBaseConfig {
  /** Template rendered inside the overlay pane. */
  template: TemplateRef<C>;

  /** Declaring view of `template`; keeps DI and queries working. */
  viewContainerRef: ViewContainerRef;

  /** Context for the embedded view. */
  context?: C;
}

/** Config for `PopoverService.openComponent`, which renders a component. */
export interface PopoverComponentConfig extends PopoverBaseConfig {
  /** View container the component is created in (for DI/injection). */
  viewContainerRef?: ViewContainerRef;

  /** Injector supplying the component's dependencies. */
  injector?: Injector;
}
