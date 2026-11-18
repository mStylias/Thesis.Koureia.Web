import { booleanAttribute, Component, computed, input, numberAttribute } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { PROGRESS_TRANSLOCO_SCOPE, progressNameKey } from '../progress.i18n';
import {
  clampPercent,
  ProgressMode,
  ProgressSize,
  ProgressSpin,
  ProgressTone,
} from '../progress.types';

/** Circle radius in `viewBox` units. */
const RADIUS = 19;
/**
 * `pathLength` normalized to 100, so every dash value is a plain percentage of the ring.
 * That lets the SCSS keyframes use literal numbers, which interpolate smoothly — values
 * built from `calc(var(...))` snap between keyframes instead.
 */
const PATH_LENGTH = 100;
/** Visible arc (of {@link PATH_LENGTH}) while linearly spinning. */
const INDETERMINATE_ARC = 25;

let nextUniqueId = 0;

/**
 * Design-system circular progress spinner. Indeterminate by default, a rotating arc for
 * work of unknown length; `mode="determinate"` with a `value` makes it a still ring filled
 * via `stroke-dashoffset`, so the value reads clearly.
 *
 * ```ts
 * import { ProgressSpinner } from '@ui/progress';
 * ```
 *
 * ```html
 * <lib-progress-spinner ariaLabel="Loading" />
 * <lib-progress-spinner mode="determinate" [value]="75" showValue ariaLabel="Upload" />
 * ```
 *
 * `showValue`, or projected content, gives a determinate spinner a centred label. Renders
 * `role="progressbar"` with `aria-valuemin/max/now`, `now` omitted while indeterminate.
 * Name it via `ariaLabel`/`ariaLabelledby`, or let it fall back to `Loading`/`Progress`.
 */
@Component({
  selector: 'lib-progress-spinner',
  template: `
    <svg class="progress-spinner-svg" viewBox="0 0 44 44" focusable="false" aria-hidden="true">
      <circle
        class="progress-spinner-track"
        cx="22"
        cy="22"
        [attr.r]="radius"
        pathLength="100"
        fill="none"
      />
      <circle
        class="progress-spinner-indicator"
        cx="22"
        cy="22"
        [attr.r]="radius"
        pathLength="100"
        fill="none"
        [attr.stroke-dasharray]="dashArray()"
        [attr.stroke-dashoffset]="dashOffset()"
      />
    </svg>
    <!-- The slot must not depend on showValue: content projected into a block
         that never renders is never created, so gating it on a flag that
         defaults to false silently dropped the consumer label. Empty, the span
         is an inset overlay with nothing in it. -->
    @if (mode() === 'determinate') {
      <span class="progress-spinner-label"
        ><ng-content>
          @if (showValue()) {
            {{ displayValue() }}
          }
        </ng-content></span
      >
    }
    <!-- See ProgressBar: named by reference, because a host binding cannot run
         the pipe that registers the scope lazy loader. -->
    @if (fallbackNameId(); as nameId) {
      <span class="progress-spinner-a11y-text" [id]="nameId" aria-hidden="true">{{
        nameKey() | uiCopy | transloco
      }}</span>
    }
  `,
  styleUrl: './progress-spinner.scss',
  imports: [TranslocoPipe, UiCopyPipe],
  providers: [PROGRESS_TRANSLOCO_SCOPE],
  host: {
    role: 'progressbar',
    '[attr.data-mode]': 'mode()',
    '[attr.data-tone]': 'tone()',
    '[attr.data-size]': 'size()',
    '[attr.data-spin]': 'spin()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
    '[attr.aria-valuenow]': 'mode() === "determinate" ? percent() : null',
    '[attr.aria-label]': 'hostAriaLabel()',
    '[attr.aria-labelledby]': 'hostAriaLabelledby()',
  },
})
export class ProgressSpinner {
  /** Completion percentage, `0`–`100`. Clamped; ignored while indeterminate. */
  readonly value = input(0, { transform: numberAttribute });

  /** `indeterminate` (default) spins; `determinate` fills the ring to `value`. */
  readonly mode = input<ProgressMode>('indeterminate');

  /**
   * Indeterminate motion. `linear` is a steady rotation; `ease` is the Material-style spin
   * where the arc grows, shrinks and changes pace. Ignored while determinate.
   */
  readonly spin = input<ProgressSpin>('linear');

  /** Emphasis colour. Defaults to the brand `accent`. */
  readonly tone = input<ProgressTone>('accent');

  /** Diameter on the shared control scale. Defaults to `md`. */
  readonly size = input<ProgressSize>('md');

  /** Show the centred percentage label (determinate only). Defaults to `false`. */
  readonly showValue = input(false, { transform: booleanAttribute });

  /** Unit appended to the built-in label. Defaults to `%`. */
  readonly unit = input('%');

  /** Accessible name for the spinner. */
  readonly ariaLabel = input('');

  /** `id` of an element naming the spinner (alternative to `ariaLabel`). */
  readonly ariaLabelledby = input('');

  protected readonly radius = RADIUS;

  private readonly uniqueId = nextUniqueId++;

  /** `value` clamped into `[0, 100]` and rounded for display and ARIA. */
  protected readonly percent = computed(() => Math.round(clampPercent(this.value())));

  protected readonly displayValue = computed(() => `${this.percent()}${this.unit()}`);

  /**
   * Determinate draws the full ring and the offset trims it; indeterminate draws a fixed
   * arc CSS rotates. On the normalized 0–{@link PATH_LENGTH} scale.
   */
  protected readonly dashArray = computed(() =>
    this.mode() === 'determinate' ? PATH_LENGTH : `${INDETERMINATE_ARC} ${PATH_LENGTH}`,
  );

  /** How much of the determinate ring to hide, from the end. */
  protected readonly dashOffset = computed(() =>
    this.mode() === 'determinate' ? PATH_LENGTH - this.percent() : 0,
  );

  /** Id of the built-in name, or `null` when the consumer supplied one. */
  protected readonly fallbackNameId = computed(() =>
    this.ariaLabel() || this.ariaLabelledby() ? null : `lib-progress-spinner-name-${this.uniqueId}`,
  );

  /** `Loading` while indeterminate, `Progress` while not. */
  protected readonly nameKey = computed(() => progressNameKey(this.mode()));

  /**
   * Dropped when `ariaLabelledby` is given — it wins the name computation, so emitting
   * both leaves the consumer's own name set but unused.
   */
  protected readonly hostAriaLabel = computed(() =>
    this.ariaLabelledby() ? null : this.ariaLabel() || null,
  );

  protected readonly hostAriaLabelledby = computed(
    () => this.ariaLabelledby() || this.fallbackNameId(),
  );
}
