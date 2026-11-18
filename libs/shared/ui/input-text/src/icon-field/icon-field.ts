import {
  afterEveryRender,
  booleanAttribute,
  Component,
  Directive,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideX } from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { IconFieldPosition } from './icon-field.types';

/** Marks the decorative icon shown inside an `libIconField` input. */
@Directive({
  selector: '[libInputIcon]',
  host: { 'aria-hidden': 'true' },
})
export class InputIcon {}

/**
 * Adds an icon inside the input box and/or a × that clears it while it has a value. An
 * attribute on the wrapper you already write.
 *
 * ```html
 * <div libIconField showClear>
 *   <span libInputIcon><svg lucideSearch></svg></span>
 *   <input libInputText placeholder="Search" />
 * </div>
 * ```
 *
 * The icon is decorative (`aria-hidden`, no pointer events); place it before or after the
 * input and set `iconPosition` to match. Clearing dispatches a native `input` event, so
 * `[formField]` and any other listener stay in sync. The button is withheld while the input
 * is `disabled` or `readonly`.
 *
 * The wrapper reports `data-filled` so a surrounding `libFloatLabel` can still detect a
 * value: the input is its grandchild here, and `:placeholder-shown` only reaches a child.
 */
@Component({
  // Attribute selector on the consumer's own wrapper.
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: '[libIconField]',
  imports: [LucideX, TranslocoPipe, UiCopyPipe],
  providers: [
    provideTranslocoScope({
      scope: 'iconField',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  template: `
    <ng-content />
    @if (showClear() && filled() && editable()) {
      <button
        type="button"
        class="input-clear-button"
        [attr.aria-label]="clearAriaLabel() || ('iconField.clear' | uiCopy | transloco)"
        (click)="clear()"
      >
        <svg lucideX aria-hidden="true"></svg>
      </button>
    }
  `,
  // Styles are global: they must reach the projected input and icon, which emulated
  // encapsulation cannot.
  host: {
    '[attr.data-icon-position]': 'iconPosition()',
    '[attr.data-clearable]': 'showClear() ? "" : null',
    // Filled contract consumed by the float/IFTA label wrappers.
    '[attr.data-filled]': 'filled() ? "" : null',
    // Keyboard and paste edits; programmatic writes are caught by afterEveryRender below.
    '(input)': 'syncFilled()',
  },
})
export class IconField {
  /** Which side of the input the `libInputIcon` sits on. */
  readonly iconPosition = input<IconFieldPosition>('left');

  /** Shows a × button that empties the input while it has a value. */
  readonly showClear = input(false, { transform: booleanAttribute });

  /** Accessible name of the × button. Falls back to the translation. */
  readonly clearAriaLabel = input('');

  /** Emitted after the input has been cleared. */
  readonly cleared = output();

  protected readonly filled = signal(false);

  /** Whether the input accepts edits. `disabled`/`readOnly` are DOM properties, so they
   * are sampled alongside `value`. */
  protected readonly editable = signal(true);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // `value` is a DOM property, so re-check after every render to catch programmatic writes.
    afterEveryRender(() => {
      this.syncFilled();
    });
  }

  protected clear(): void {
    const input = this.input();
    // The button is hidden when the input is locked, so this only guards a stale click.
    if (!input || input.disabled || input.readOnly) {
      return;
    }
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    this.syncFilled();
    this.cleared.emit();
  }

  protected syncFilled(): void {
    const input = this.input();
    this.filled.set(!!input?.value);
    this.editable.set(!!input && !input.disabled && !input.readOnly);
  }

  private input(): HTMLInputElement | null {
    return this.host.nativeElement.querySelector('input');
  }
}
