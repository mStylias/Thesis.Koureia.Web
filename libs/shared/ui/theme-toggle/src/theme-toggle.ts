import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideMoon, LucideSun } from '@lucide/angular';
import { Button, ButtonSize } from '@ui/button';
import { ThemeService } from '@util/brand';

import { themeToggleTranslocoScope } from './theme-toggle.i18n';

/**
 * Flips the interface between light and dark.
 *
 * ```html
 * <lib-theme-toggle size="sm" />
 * ```
 *
 * ## Why a toggle button and not a three-way control
 *
 * `ThemeService` also understands `system`, and that is the *initial* state for anyone who
 * has never chosen — absent `data-theme` is what hands control to `prefers-color-scheme`.
 * This control does not offer it as a destination. A person reaching for a theme switch is
 * asking for a specific theme, and a third option whose label has to explain itself buys
 * nothing on a marketing header. Someone who wants the OS to decide again has never
 * touched this, which is the state they are already in.
 *
 * ## The accessible name does not change
 *
 * It is always "dark theme"; whether that is *on* rides on `aria-pressed`. A name that
 * flipped between "switch to dark" and "switch to light" would be re-announced in the
 * middle of the interaction that changed it, describing the control instead of the state.
 * The icon still swaps, because that is a visual affordance and not the name.
 */
@Component({
  selector: 'lib-theme-toggle',
  imports: [Button, LucideMoon, LucideSun, TranslocoPipe, UiCopyPipe],
  providers: [provideTranslocoScope(themeToggleTranslocoScope)],
  template: `
    <button
      libButton
      type="button"
      variant="text"
      severity="secondary"
      [size]="size()"
      iconOnly
      rounded
      [attr.aria-pressed]="isDark()"
      [attr.aria-label]="ariaLabel() || ('themeToggle.label' | uiCopy | transloco)"
      (click)="toggle()"
    >
      @if (isDark()) {
        <svg lucideMoon aria-hidden="true"></svg>
      } @else {
        <svg lucideSun aria-hidden="true"></svg>
      }
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }

    svg {
      width: var(--icon-size-md);
      height: var(--icon-size-md);
      stroke-width: var(--icon-stroke);
    }
  `,
})
export class ThemeToggle {
  private readonly theme = inject(ThemeService);

  /** Matches the surrounding controls. `sm` in a header. */
  readonly size = input<ButtonSize>('md');

  /** Overrides the translated accessible name. Falls back to the translation when empty. */
  readonly ariaLabel = input('');

  protected readonly isDark = computed(() => this.theme.resolved() === 'dark');

  protected toggle(): void {
    this.theme.toggle();
  }
}
