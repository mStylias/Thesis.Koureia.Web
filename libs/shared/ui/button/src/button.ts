import { isPlatformBrowser } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  numberAttribute,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { LucideLoaderCircle } from '@lucide/angular';

/** Floor on how long the spinner is up, in milliseconds. Matches `@ui/loading-screen`. */
const DEFAULT_MIN_DURATION = 500;

/** Semantic color. */
export type ButtonSeverity = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error';

export type ButtonVariant = 'filled' | 'outlined' | 'text';

export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Marks a projected icon as the one `loading` replaces.
 *
 * ```html
 * <button libButton [loading]="saving()">
 *   <svg lucideSave libButtonIcon aria-hidden="true"></svg>
 *   Save
 * </button>
 * ```
 *
 * Without it an icon stays put and the spinner is drawn before it, which widens the button
 * mid-action. With it the spinner takes the icon's place and the caption does not move.
 */
@Directive({ selector: '[libButtonIcon]' })
export class ButtonIcon {}

/**
 * Design-system button. Applied as an attribute on a native
 * `<button>` or `<a>` element so it keeps native semantics, keyboard
 * behavior, and form participation.
 *
 * ```ts
 * import { Button } from '@ui/button';
 * ```
 *
 * ```html
 * <button libButton>Book now</button>
 * <button libButton severity="error" variant="outlined" size="sm">Cancel</button>
 * <button libButton iconOnly rounded aria-label="Favorite">★</button>
 * <a libButton href="/booking" severity="secondary">View booking</a>
 * ```
 *
 * `loading` draws a spinner and blocks interaction. Mark the icon it replaces with
 * `libButtonIcon`; the caption stays, so the accessible name never changes under focus.
 *
 * ```html
 * <button libButton [loading]="form().submitting()">
 *   <svg lucideSave libButtonIcon aria-hidden="true"></svg>
 *   Save
 * </button>
 * ```
 */
@Component({
  selector: 'button[libButton], a[libButton]',
  templateUrl: './button.html',
  styleUrl: './button.scss',
  imports: [LucideLoaderCircle],
  host: {
    '[attr.data-severity]': 'severity()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.data-icon-only]': 'iconOnly() ? "" : null',
    '[attr.data-rounded]': 'rounded() ? "" : null',
    '[attr.data-raised]': 'raised() ? "" : null',
    '[attr.data-loading]': 'spinning() ? "" : null',
    '[attr.disabled]': 'nativeDisabled()',
    '[attr.aria-disabled]': 'blocked() ? true : null',
    '[attr.aria-busy]': 'spinning() ? true : null',
    '[attr.tabindex]': 'tabIndex()',
    '(click)': 'onClick($event)',
  },
})
export class Button {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * `<a>` has no native disabled state: the attribute is inert there,
   * `:disabled` never matches, and the element stays focusable. So the
   * anchor case is emulated below instead of pretending otherwise.
   */
  private readonly isAnchor = this.host.nativeElement.tagName === 'A';

  /** A consumer-set `tabindex`, restored whenever we stop forcing -1. */
  private readonly initialTabIndex = this.host.nativeElement.getAttribute('tabindex');

  /** Semantic color. Defaults to `primary` (the brand accent). */
  readonly severity = input<ButtonSeverity>('primary');

  /** Visual style. Defaults to `filled`. */
  readonly variant = input<ButtonVariant>('filled');

  /** Control size. Defaults to `md`. */
  readonly size = input<ButtonSize>('md');

  /** Equal width/height icon-only control. Requires an `aria-label`. */
  readonly iconOnly = input(false, { transform: booleanAttribute });

  /** Pill / circle shape. */
  readonly rounded = input(false, { transform: booleanAttribute });

  /** Elevated shadow. */
  readonly raised = input(false, { transform: booleanAttribute });

  /** Disables interaction — also on `<a>` hosts, which have no native `disabled`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /**
   * An action of this button's is in flight: a spinner replaces the `libButtonIcon`, the host
   * reports `aria-busy`, and interaction is blocked so it cannot be pressed twice.
   *
   * The caption is deliberately untouched. The button holds focus after a press, and a name
   * that changes there is re-announced mid-interaction.
   */
  readonly loading = input(false, { transform: booleanAttribute });

  /**
   * Floor on how long the spinner stays up once `loading` has raised it. Defaults to `500`.
   *
   * It is a floor on the total, not a delay on top of it: a 900ms action spins for 900ms and a
   * 60ms one spins for 500ms. A spinner that appears for two frames reads as a glitch rather
   * than as feedback, and a button that flickers back to idle looks like it refused the press.
   * `0` turns the floor off.
   */
  readonly minDuration = input(DEFAULT_MIN_DURATION, { transform: numberAttribute });

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** True from the frame `loading` rises until the floor elapses. */
  private readonly holding = signal(false);

  /** Set while a floor timer is pending, so a second rise cannot restart it. */
  private timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Whether the spinner is up: the action is running, or the floor has not elapsed yet.
   *
   * Everything the loading state carries reads this rather than `loading`, so a button held by
   * the floor alone still reports `aria-busy` and still refuses a press. A spinning button that
   * accepted one would take a second submission for the action that just finished.
   */
  protected readonly spinning = computed(() => this.loading() || this.holding());

  /** A negative or fractional attribute value must not become a negative timeout. */
  private readonly floorMs = computed(() => {
    const ms = this.minDuration();
    return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
  });

  /**
   * Whether interaction is refused. A pending action is as good a reason as a disabled input,
   * and a consumer that had to set both would be able to set only one.
   */
  protected readonly blocked = computed(() => this.disabled() || this.spinning());

  /** The real `disabled` attribute, which only `<button>` understands. */
  protected readonly nativeDisabled = computed(() =>
    !this.isAnchor && this.blocked() ? true : null,
  );

  /** A blocked anchor leaves the tab order, like a disabled button. */
  protected readonly tabIndex = computed(() =>
    this.isAnchor && this.blocked() ? '-1' : this.initialTabIndex,
  );

  /**
   * Stops activation of a disabled anchor. `pointer-events: none` only
   * covers the mouse; Enter on a focused anchor dispatches a click that
   * navigates, and the element can still be focused programmatically.
   * Runs before consumer listeners on the same element, so their
   * handlers stay unreached too.
   */
  protected onClick(event: Event): void {
    if (this.isAnchor && this.blocked()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });

    effect(() => {
      // No timer on the server: a render is one shot, so a floor could only hold the response
      // back, and there is no spinner to keep on screen either way.
      if (!this.isBrowser || !this.loading() || this.timer !== undefined) return;

      this.holding.set(true);
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.holding.set(false);
      }, this.floorMs());
    });
  }
}
