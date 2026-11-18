import { booleanAttribute, Component, computed, inject, input, output } from '@angular/core';
import { Tab as AriaTab } from '@angular/aria/tabs';
import { LucideX } from '@lucide/angular';
import { Tooltip } from '@ui/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { TABS_TRANSLOCO_SCOPE } from './tabs.i18n';

/**
 * A tab header inside a `lib-tab-list`, linked by `value` to the panel sharing it. Built on
 * the headless `ngTab`, which supplies roving focus, `role="tab"`, `aria-selected` and
 * `aria-controls`.
 *
 * ```html
 * <lib-tab value="profile">Profile</lib-tab>
 * <lib-tab value="settings" disabled>Settings</lib-tab>
 * ```
 *
 * Project any markup for rich headers. `closable` renders a × and emits `(closed)`.
 *
 * The × is pointer-only: ARIA gives `role="tab"` presentational children, so a focusable
 * control inside would lose its role and name in the accessibility tree while staying in
 * the tab order. Keyboard users close with Delete or Backspace, advertised as
 * `aria-keyshortcuts`.
 *
 * `value`, `disabled` and `id` come from `ngTab` and bind directly on `lib-tab`.
 */
@Component({
  selector: 'lib-tab',
  imports: [LucideX, Tooltip, TranslocoPipe, UiCopyPipe],
  template: `
    <span class="tab-label"><ng-content /></span>
    @if (closable() && !disabled()) {
      <!-- Pointer-only by design (see the class docs); the keyboard path is
           the host's Delete/Backspace handler. -->
      <span
        class="tab-close"
        aria-hidden="true"
        [libTooltip]="closeAriaLabel() || ('tabs.closeLabel' | uiCopy | transloco)"
        (click)="onClose($event)"
      >
        <svg lucideX></svg>
      </span>
    }
  `,
  styleUrl: './tab.scss',
  providers: [TABS_TRANSLOCO_SCOPE],
  hostDirectives: [
    {
      directive: AriaTab,
      inputs: ['value', 'disabled', 'id'],
    },
  ],
  host: {
    class: 'tab',
    '[attr.aria-keyshortcuts]': 'closeShortcut()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class Tab {
  /** Shows a × affordance that emits `(close)` instead of selecting. */
  readonly closable = input(false, { transform: booleanAttribute });

  /**
   * Tooltip for the ×. Not an accessible name: it sits inside `role="tab"`, whose children
   * are presentational. Empty falls back to the translation.
   */
  readonly closeAriaLabel = input('');

  /** Emitted when the × affordance is activated (a request to close). */
  readonly closed = output();

  /** The headless aria tab — the source of value/disabled/selection state. */
  private readonly aria = inject(AriaTab);

  /** This tab's value (bound on the host via the `ngTab` input). */
  readonly value = this.aria.value;

  /** Whether this tab is disabled (bound on the host via `ngTab`). */
  readonly disabled = this.aria.disabled;

  /** Advertises the keyboard close path, only while one exists. */
  protected readonly closeShortcut = computed(() => (this.canClose() ? 'Delete' : null));

  /** Host element, used by the tab list to measure the ink-bar. */
  get element(): HTMLElement {
    return this.aria.element;
  }

  protected onClose(event: MouseEvent): void {
    if (!this.canClose()) {
      return;
    }
    // Keep the click from bubbling to the tablist and selecting the tab.
    event.stopPropagation();
    this.closed.emit();
  }

  /** Keyboard equivalent of the × affordance. */
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.canClose() || (event.key !== 'Delete' && event.key !== 'Backspace')) {
      return;
    }
    // Backspace navigates back in some browsers, and the tablist must not see it either.
    event.preventDefault();
    event.stopPropagation();
    this.closed.emit();
  }

  private canClose(): boolean {
    return this.closable() && !this.disabled();
  }
}
