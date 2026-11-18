import { Component, computed, input, linkedSignal } from '@angular/core';

import type { StaffAvatarSize } from './staff-avatar.types';

/**
 * A member's photo, or their initials on a tint. Decorative: the name always sits beside it, so the
 * image has an empty `alt`.
 *
 * ```html
 * <lib-staff-avatar [avatarUrl]="member.avatarUrl" [initials]="member.initials" size="lg" />
 * ```
 */
@Component({
  selector: 'lib-staff-avatar',
  template: `
    @if (showPhoto()) {
      <img
        class="avatar-photo"
        alt=""
        loading="lazy"
        decoding="async"
        [src]="avatarUrl()"
        (error)="failed.set(true)"
      />
    } @else {
      <span class="avatar-initials">{{ initials() }}</span>
    }
  `,
  styleUrl: './staff-avatar.scss',
  host: {
    'aria-hidden': 'true',
    '[attr.data-size]': 'size()',
  },
})
export class StaffAvatar {
  readonly avatarUrl = input<string | null>(null);
  readonly initials = input('');
  readonly size = input<StaffAvatarSize>('md');

  /** A photo that did not load shows the initials, until another URL arrives. */
  protected readonly failed = linkedSignal({ source: this.avatarUrl, computation: () => false });

  protected readonly showPhoto = computed(() => !!this.avatarUrl() && !this.failed());
}
