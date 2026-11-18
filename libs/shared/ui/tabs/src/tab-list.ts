import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TabList as AriaTabList } from '@angular/aria/tabs';
import { Tab } from './tab';
import { TabsOrientation } from './tabs.types';

/**
 * The strip of `lib-tab` headers. Built on the headless `@angular/aria`
 * `ngTabList` — keyboard navigation, roving focus, and the `role="tablist"`
 * contract come from Angular. Owns the sliding accent indicator.
 *
 * ```html
 * <lib-tab-list orientation="horizontal" selectionMode="follow">
 *   <lib-tab value="a">One</lib-tab>
 *   <lib-tab value="b">Two</lib-tab>
 * </lib-tab-list>
 * ```
 *
 * `selectionMode` defaults to `follow` (automatic activation — the focused
 * tab is selected as you arrow through). Set it to `explicit` for manual
 * activation when a panel is expensive to render.
 */
@Component({
  selector: 'lib-tab-list',
  template: `
    <ng-content />
    <span #ink class="tab-ink" aria-hidden="true"></span>
  `,
  styleUrl: './tab-list.scss',
  hostDirectives: [
    {
      directive: AriaTabList,
      inputs: [
        'orientation',
        'wrap',
        'focusMode',
        'selectionMode',
        'softDisabled',
        'disabled',
        'selectedTab: value',
      ],
      outputs: ['selectedTabChange: valueChange'],
    },
  ],
  host: {
    class: 'tab-list',
    '[attr.data-orientation]': 'orientation()',
  },
})
export class TabList {
  private readonly aria = inject(AriaTabList);
  private readonly host = inject(ElementRef).nativeElement as HTMLElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly ink = viewChild.required<ElementRef<HTMLElement>>('ink');
  private readonly tabs = contentChildren(Tab, { descendants: true });

  /** Current layout axis (read from the aria pattern). */
  readonly orientation = computed<TabsOrientation>(() => this.aria.orientation());

  /** The value of the selected tab, or `undefined` while none is. */
  readonly selectedValue = computed(() => this.aria.selectedTab());

  private readonly geometryTick = signal(0);

  /** Changes each time the strip or one of its tabs changes size. */
  readonly geometry = this.geometryTick.asReadonly();

  private observer?: ResizeObserver;
  private hasPlacedInk = false;
  // Last values written to the ink element. Writing the inline `style` is
  // observed by the Storybook example-container resizer (and is plain DOM
  // churn everywhere else), so we only write when the geometry actually
  // changed — otherwise a spurious resize re-measures to the same transform,
  // writes nothing, and no feedback loop can form.
  private lastTransform = '';
  private lastOpacity = '';

  constructor() {
    afterNextRender(() => {
      this.observer = new ResizeObserver(() => {
        this.geometryTick.update((v) => v + 1);
      });
      this.destroyRef.onDestroy(() => {
        this.observer?.disconnect();
      });
      this.observeGeometry();
    });

    // Observe each tab too: a block-level strip keeps its width when a label
    // loads or a font swaps, so the strip alone misses those changes.
    afterRenderEffect(() => {
      this.tabs();
      this.observeGeometry();
    });

    // Reposition the ink-bar whenever the selection, orientation, tab set,
    // or geometry changes. Runs after layout so offsets are accurate.
    afterRenderEffect(() => {
      this.selectedValue();
      this.orientation();
      this.tabs();
      this.geometryTick();
      this.placeInk();
    });
  }

  private observeGeometry(): void {
    const observer = this.observer;
    if (!observer) {
      return;
    }
    observer.disconnect();
    observer.observe(this.host);
    for (const tab of this.tabs()) {
      observer.observe(tab.element);
    }
  }

  private placeInk(): void {
    const ink = this.ink().nativeElement;
    const selected = this.tabs().find((tab) => tab.value() === this.selectedValue());

    if (!selected) {
      this.setInkOpacity(ink, '0');
      return;
    }

    const el = selected.element;
    const vertical = this.orientation() === 'vertical';
    // The bar is 1px on its main axis and scaled to the tab's size, so the
    // whole move is a GPU-only transform (no layout/paint per frame).
    const transform = vertical
      ? `translateY(${el.offsetTop}px) scaleY(${el.offsetHeight})`
      : `translateX(${el.offsetLeft}px) scaleX(${el.offsetWidth})`;

    // Nothing moved — don't touch the DOM (see `lastTransform`).
    if (transform === this.lastTransform && this.lastOpacity === '1') {
      return;
    }

    if (this.hasPlacedInk) {
      this.setInkTransform(ink, transform);
      this.setInkOpacity(ink, '1');
      return;
    }

    // Place the bar without sliding in from the origin on first paint.
    ink.style.transition = 'none';
    this.setInkTransform(ink, transform);
    this.setInkOpacity(ink, '1');
    ink.getBoundingClientRect();
    ink.style.transition = '';
    this.hasPlacedInk = true;
  }

  private setInkTransform(ink: HTMLElement, transform: string): void {
    if (transform === this.lastTransform) {
      return;
    }
    this.lastTransform = transform;
    ink.style.transform = transform;
  }

  private setInkOpacity(ink: HTMLElement, opacity: string): void {
    if (opacity === this.lastOpacity) {
      return;
    }
    this.lastOpacity = opacity;
    ink.style.opacity = opacity;
  }
}
