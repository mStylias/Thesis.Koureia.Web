import { booleanAttribute, Component, computed, input, numberAttribute } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { PROGRESS_TRANSLOCO_SCOPE, progressNameKey } from '../progress.i18n';
import { clampPercent, ProgressMode, ProgressSize, ProgressTone } from '../progress.types';

let nextUniqueId = 0;

/**
 * Design-system linear progress bar: a track filling to a known percentage
 * (`determinate`) or animating a travelling segment (`indeterminate`).
 *
 * ```ts
 * import { ProgressBar } from '@ui/progress';
 * ```
 *
 * ```html
 * <lib-progress-bar [value]="uploaded()" ariaLabel="Upload progress" />
 * <lib-progress-bar mode="indeterminate" ariaLabel="Loading" />
 * ```
 *
 * `showValue` prints the rounded percentage. Project content to replace it with your own
 * label, which receives no automatic value so you control the wording:
 *
 * ```html
 * <lib-progress-bar [value]="done()" ariaLabel="Sync">
 *   {{ done() }} of {{ total() }} files
 * </lib-progress-bar>
 * ```
 *
 * Renders `role="progressbar"` with `aria-valuemin/max/now`, `now` omitted while
 * indeterminate. Name it via `ariaLabel` or `ariaLabelledby` — the visible percentage is a
 * value, not a name. With neither it falls back to `Progress`/`Loading`, never nameless.
 */
@Component({
  selector: 'lib-progress-bar',
  template: `
    <div class="progress-bar-track">
      <div
        class="progress-bar-fill"
        [style.--_scale]="mode() === 'determinate' ? scale() : null"
      ></div>
    </div>
    @if (showValue() && mode() === 'determinate') {
      <span class="progress-bar-label"
        ><ng-content>{{ displayValue() }}</ng-content></span
      >
    }
    <!-- Named by reference rather than by an imperative translation: a host
         binding cannot run a pipe, and only a transformed pipe registers the
         scope lazy loader. aria-hidden keeps the text out of the progressbar
         subtree — an id reference is resolved either way. -->
    @if (fallbackNameId(); as nameId) {
      <span class="progress-bar-a11y-text" [id]="nameId" aria-hidden="true">{{
        nameKey() | uiCopy | transloco
      }}</span>
    }
  `,
  styleUrl: './progress-bar.scss',
  imports: [TranslocoPipe, UiCopyPipe],
  providers: [PROGRESS_TRANSLOCO_SCOPE],
  host: {
    role: 'progressbar',
    '[attr.data-mode]': 'mode()',
    '[attr.data-tone]': 'tone()',
    '[attr.data-size]': 'size()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
    '[attr.aria-valuenow]': 'mode() === "determinate" ? percent() : null',
    '[attr.aria-label]': 'hostAriaLabel()',
    '[attr.aria-labelledby]': 'hostAriaLabelledby()',
  },
})
export class ProgressBar {
  /** Completion percentage, `0`–`100`. Clamped; ignored while indeterminate. */
  readonly value = input(0, { transform: numberAttribute });

  /** `determinate` (default) tracks `value`; `indeterminate` animates. */
  readonly mode = input<ProgressMode>('determinate');

  /** Emphasis colour. Defaults to the brand `accent`. */
  readonly tone = input<ProgressTone>('accent');

  /** Track height on the shared control scale. Defaults to `md`. */
  readonly size = input<ProgressSize>('md');

  /** Show the built-in percentage label (determinate only). Defaults to `true`. */
  readonly showValue = input(true, { transform: booleanAttribute });

  /** Unit appended to the built-in label. Defaults to `%`. */
  readonly unit = input('%');

  /** Accessible name for the progress bar. */
  readonly ariaLabel = input('');

  /** `id` of an element naming the progress bar (alternative to `ariaLabel`). */
  readonly ariaLabelledby = input('');

  private readonly uniqueId = nextUniqueId++;

  /** `value` clamped into `[0, 100]` and rounded for display and ARIA. */
  protected readonly percent = computed(() => Math.round(clampPercent(this.value())));

  /** Fill fraction (`0`–`1`) for the `scaleX` transform. */
  protected readonly scale = computed(() => this.percent() / 100);

  /** The built-in label text, e.g. `72%`. */
  protected readonly displayValue = computed(() => `${this.percent()}${this.unit()}`);

  /** Id of the built-in name, or `null` when the consumer supplied one. */
  protected readonly fallbackNameId = computed(() =>
    this.ariaLabel() || this.ariaLabelledby() ? null : `lib-progress-bar-name-${this.uniqueId}`,
  );

  /** `Progress` while determinate, `Loading` while not. */
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
