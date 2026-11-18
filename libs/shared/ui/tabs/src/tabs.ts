import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronUp,
} from '@lucide/angular';
import { Tabs as AriaTabs } from '@angular/aria/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { Tooltip } from '@ui/tooltip';
import { UiCopyPipe } from '@util/ui-copy';
import { TabList } from './tab-list';
import { TABS_TRANSLOCO_SCOPE } from './tabs.i18n';
import { TabsOrientation } from './tabs.types';

/** Fraction of the viewport kept visible after a prev/next scroll. */
const SCROLL_OVERLAP = 0.2;

/**
 * Design-system tabs on the headless `@angular/aria` pattern, which supplies keyboard
 * navigation, focus management and the ARIA contract.
 *
 * ```ts
 * import { Tabs, TabList, Tab, TabPanel } from '@ui/tabs';
 * ```
 *
 * ```html
 * <lib-tabs [(value)]="active">
 *   <lib-tab-list>
 *     <lib-tab value="profile">Profile</lib-tab>
 *     <lib-tab value="billing">Billing</lib-tab>
 *   </lib-tab-list>
 *   <lib-tab-panel value="profile">…</lib-tab-panel>
 *   <lib-tab-panel value="billing">…</lib-tab-panel>
 * </lib-tabs>
 * ```
 *
 * Bind selection with `[(value)]` on `lib-tab-list`. `scrollable` gives an overflowing
 * strip prev/next buttons, each scrolling ~80% of the viewport so a few seen tabs stay on
 * screen as anchors.
 */
@Component({
  selector: 'lib-tabs',
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
  imports: [
    LucideChevronLeft,
    LucideChevronRight,
    LucideChevronUp,
    LucideChevronDown,
    Tooltip,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [TABS_TRANSLOCO_SCOPE],
  hostDirectives: [AriaTabs],
  host: {
    class: 'tabs',
    '[attr.data-orientation]': 'orientation()',
    '[attr.data-scrollable]': 'scrollable() ? "" : null',
  },
})
export class Tabs {
  /** On overflow, prev/next buttons appear and the strip scrolls instead of wrapping. */
  readonly scrollable = input(false, { transform: booleanAttribute });

  /**
   * Tooltip for the scroll-back button. Not an accessible name: the button is a
   * pointer-only affordance and `aria-hidden`. Empty falls back to the translation.
   */
  readonly scrollPrevAriaLabel = input('');

  /** Tooltip for the scroll-forward button; see `scrollPrevAriaLabel`. */
  readonly scrollNextAriaLabel = input('');

  private readonly list = contentChild(TabList);
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly destroyRef = inject(DestroyRef);

  /** Layout axis, mirrored from the tab list (default horizontal). */
  protected readonly orientation = computed<TabsOrientation>(
    () => this.list()?.orientation() ?? 'horizontal',
  );
  protected readonly vertical = computed(() => this.orientation() === 'vertical');

  protected readonly canScrollStart = signal(false);
  protected readonly canScrollEnd = signal(false);
  // The buttons render only while the tabs overflow, so a strip that fits keeps their room.
  protected readonly overflowing = signal(false);

  // Keep the selected tab in view until the user scrolls away with a button.
  private followSelection = true;
  private hasRevealed = false;

  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver(() => {
        this.onGeometryChange();
      });
      observer.observe(this.viewport().nativeElement);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });

    // A new selection scrolls in. The first one jumps, so the page does not open with motion.
    afterRenderEffect(() => {
      this.list()?.selectedValue();
      this.orientation();
      this.followSelection = true;
      this.scrollActiveIntoView(this.hasRevealed ? this.scrollBehavior() : 'instant');
      this.hasRevealed = true;
      this.updateMetrics();
    });

    // The tab list observes its tabs, so a label that loads late counts too.
    afterRenderEffect(() => {
      this.list()?.geometry();
      this.onGeometryChange();
    });
  }

  protected onScroll(): void {
    this.updateMetrics();
  }

  protected scrollByStep(direction: 1 | -1): void {
    const vp = this.viewport().nativeElement;
    const extent = this.vertical() ? vp.clientHeight : vp.clientWidth;
    const amount = extent * (1 - SCROLL_OVERLAP) * direction;
    const behavior = this.scrollBehavior();
    this.followSelection = false;
    vp.scrollBy(this.vertical() ? { top: amount, behavior } : { left: amount, behavior });
  }

  private onGeometryChange(): void {
    if (this.followSelection) {
      this.scrollActiveIntoView('instant');
    }
    this.updateMetrics();
  }

  private updateMetrics(): void {
    const vp = this.viewport().nativeElement;
    // Compare with the header, not the viewport: the buttons take viewport room, so a strip
    // that fits only without them would show and hide them in turn.
    const header = vp.parentElement ?? vp;
    this.overflowing.set(
      this.vertical()
        ? vp.scrollHeight > header.clientHeight + 1
        : vp.scrollWidth > header.clientWidth + 1,
    );
    if (this.vertical()) {
      this.canScrollStart.set(vp.scrollTop > 1);
      this.canScrollEnd.set(vp.scrollTop + vp.clientHeight < vp.scrollHeight - 1);
    } else {
      this.canScrollStart.set(vp.scrollLeft > 1);
      this.canScrollEnd.set(vp.scrollLeft + vp.clientWidth < vp.scrollWidth - 1);
    }
  }

  private scrollActiveIntoView(behavior: ScrollBehavior): void {
    if (!this.scrollable()) {
      return;
    }
    const vp = this.viewport().nativeElement;
    const active = vp.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!active) {
      return;
    }

    const vpRect = vp.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();

    if (this.vertical()) {
      const startGap = tabRect.top - vpRect.top;
      const endGap = tabRect.bottom - vpRect.bottom;
      if (startGap < 0) {
        vp.scrollBy({ top: startGap, behavior });
      } else if (endGap > 0) {
        vp.scrollBy({ top: endGap, behavior });
      }
    } else {
      const startGap = tabRect.left - vpRect.left;
      const endGap = tabRect.right - vpRect.right;
      if (startGap < 0) {
        vp.scrollBy({ left: startGap, behavior });
      } else if (endGap > 0) {
        vp.scrollBy({ left: endGap, behavior });
      }
    }
  }

  private scrollBehavior(): ScrollBehavior {
    return typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth';
  }
}
