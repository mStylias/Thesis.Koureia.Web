import { Component, computed, input } from '@angular/core';
import {
  LucideCircleAlert,
  LucideCircleCheck,
  LucideDynamicIcon,
  LucideInfo,
  LucideTriangleAlert,
  type LucideIconInput,
} from '@lucide/angular';

import type { BannerTone } from './banner.types';

const TONE_ICONS: Readonly<Record<BannerTone, LucideIconInput>> = {
  info: LucideInfo,
  success: LucideCircleCheck,
  warning: LucideTriangleAlert,
  error: LucideCircleAlert,
};

/**
 * A message in a tinted box, inline with the page: a fact to read, a confirmation, a warning or
 * an error. The tone sets the tint, the edge and the icon. The message is the projected content.
 *
 * Mark a button or link `libBannerAction` to place it in the action slot, at the end of the box.
 * The slot wraps under the message when the box is narrow.
 *
 * The banner sets no role. Add `role="status"` or `role="alert"` on the host when it appears
 * in response to an action. A banner that is part of the page from the start needs none.
 *
 * ```ts
 * import { Banner } from '@ui/banner';
 * ```
 *
 * ```html
 * <lib-banner>You can add the appointment to your calendar through the email.</lib-banner>
 *
 * <lib-banner tone="error" role="alert">
 *   The staff could not be loaded.
 *   <button libButton libBannerAction size="sm" (click)="retry()">Retry</button>
 * </lib-banner>
 *
 * <lib-banner tone="warning" heading="Not shown in online booking">
 *   <ul>…</ul>
 * </lib-banner>
 * ```
 */
@Component({
  selector: 'lib-banner',
  imports: [LucideDynamicIcon],
  template: `
    <svg class="banner-icon" [lucideIcon]="shownIcon()" aria-hidden="true"></svg>
    <div class="banner-body">
      <div class="banner-content">
        @if (heading()) {
          <p class="banner-heading">{{ heading() }}</p>
        }
        <ng-content />
      </div>
      <div class="banner-actions"><ng-content select="[libBannerAction]" /></div>
    </div>
  `,
  styleUrl: './banner.scss',
  host: {
    '[attr.data-tone]': 'tone()',
  },
})
export class Banner {
  /** The meaning of the message. Sets the tint, the edge and the default icon. */
  readonly tone = input<BannerTone>('info');
  /** A bold first line over the message. Empty shows none. */
  readonly heading = input('');
  /** Replaces the tone's icon. Pass a Lucide icon, such as `LucideShieldCheck`. */
  readonly icon = input<LucideIconInput | null>(null);

  protected readonly shownIcon = computed(() => this.icon() ?? TONE_ICONS[this.tone()]);
}
