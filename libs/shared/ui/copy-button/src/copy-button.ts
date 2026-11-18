import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { LucideCheck, LucideCopy } from '@lucide/angular';
import { Button, ButtonIcon } from '@ui/button';
import { UiCopyPipe } from '@util/ui-copy';

import type { CopyState } from './copy-button.types';

/** How long "Copied" stays before the button reads "Copy" again. */
export const COPIED_MS = 2000;

/**
 * Copies a value to the clipboard, and says so on the button for {@link COPIED_MS}.
 *
 * ```ts
 * import { CopyButton } from '@ui/copy-button';
 * ```
 *
 * ```html
 * <lib-copy-button [value]="email" label="Copy email" />
 * ```
 */
@Component({
  selector: 'lib-copy-button',
  imports: [Button, ButtonIcon, LucideCheck, LucideCopy, TranslocoPipe, UiCopyPipe],
  templateUrl: './copy-button.html',
  styleUrl: './copy-button.scss',
  // View-only: in `providers` the scope also reaches the consumer's bindings on the host.
  viewProviders: [
    provideTranslocoScope({
      scope: 'copyButton',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
})
export class CopyButton {
  /** The text that goes to the clipboard. */
  readonly value = input.required<string>();
  /** The accessible name, such as "Copy email". It must start with the visible "Copy". */
  readonly label = input.required<string>();

  protected readonly state = signal<CopyState>('idle');

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });
  }

  protected async copy(): Promise<void> {
    let copied: boolean;
    try {
      await navigator.clipboard.writeText(this.value());
      copied = true;
    } catch {
      // No clipboard outside a secure context, or the user refused it.
      copied = false;
    }
    this.state.set(copied ? 'copied' : 'failed');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.state.set('idle');
    }, COPIED_MS);
  }
}
