import { isPlatformBrowser } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  numberAttribute,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';

import { loadingScreenTranslocoScope } from './loading-screen.i18n';

/**
 * How long the splash stays up at the least, in milliseconds. Short enough that a fast load is
 * not held back noticeably, long enough that the mark is read rather than glimpsed.
 */
const DEFAULT_MIN_DURATION = 500;

/**
 * Full-screen splash for the one wait a person cannot navigate away from: the first load of a
 * client-rendered part of the app. It draws the brand mark and a sweeping indicator over an
 * opaque surface, then fades out.
 *
 * ```ts
 * import { LoadingScreen } from '@ui/loading-screen';
 * ```
 *
 * ```html
 * <lib-loading-screen [loading]="entering()" [logo]="brand.logo" />
 * ```
 *
 * ## The floor does not add to the wait
 *
 * `minDuration` is a floor on the total, not a delay on top of it. The splash goes down at the
 * later of "loading finished" and "the floor elapsed", so a 900ms load shows it for 900ms and a
 * 60ms load shows it for 500ms. The floor exists because a splash that flashes for two frames
 * reads as a glitch, not as feedback.
 *
 * ## It renders nothing when it is not needed
 *
 * `loading` is an input and not a structural condition on the consumer's side on purpose: the
 * component owns the floor, so it has to outlive the flag that raised it. Keep it mounted and
 * bind the flag; it collapses to an empty host in between.
 *
 * ## Taking over a pre-bootstrap splash
 *
 * A client-rendered address paints nothing until the bundle boots, which is the longest part of
 * the wait and the part no component can cover. An app answers that by writing the same markup
 * into `index.html`; this component then appears in Angular's first paint and the placeholder is
 * dropped. The styles are global (`styles/components/_loading-screen.scss`) so that both are the
 * same pixels, and `animateLogo` is set to `false` for the handover, because a mark that already
 * entered must not enter again.
 */
@Component({
  selector: 'lib-loading-screen',
  templateUrl: './loading-screen.html',
  // No `styleUrl`: the styles are global, so an app's pre-bootstrap copy of this markup is drawn
  // by the same rules. See `styles/components/_loading-screen.scss`.
  imports: [TranslocoPipe, UiCopyPipe],
  providers: [provideTranslocoScope(loadingScreenTranslocoScope)],
})
export class LoadingScreen {
  /** Whether the work the splash covers is still running. Raising it shows the splash. */
  readonly loading = input(false, { transform: booleanAttribute });

  /**
   * Path to the brand mark, from `BRAND` in `@util/brand`. Drawn in a square box, so a wider
   * file is letterboxed and not cropped. Empty draws the indicator alone.
   */
  readonly logo = input('');

  /** Floor on the total time the splash is up, in milliseconds. Defaults to `500`. */
  readonly minDuration = input(DEFAULT_MIN_DURATION, { transform: numberAttribute });

  /**
   * Whether the mark plays its entrance. Set it to `false` when taking over a splash that is
   * already on the screen, so the mark does not enter twice.
   */
  readonly animateLogo = input(true, { transform: booleanAttribute });

  /** Accessible name announced while the splash is up; empty falls back to the translation. */
  readonly ariaLabel = input('');

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** True from the frame `loading` rises until the floor elapses. */
  private readonly holding = signal(false);

  /** Set while a floor timer is pending, so a later input change cannot restart it. */
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected readonly visible = computed(() => this.loading() || this.holding());

  /** A negative or fractional attribute value must not become a negative timeout. */
  private readonly floorMs = computed(() => {
    const ms = this.minDuration();
    return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });

    effect(() => {
      // No timer on the server: a render is one shot, so the floor could only hold the response
      // back. The splash is for a client-rendered wait in any case.
      if (!this.isBrowser || !this.loading() || this.timer !== undefined) return;

      this.holding.set(true);
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.holding.set(false);
      }, this.floorMs());
    });
  }
}
