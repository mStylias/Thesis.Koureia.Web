import { ConnectedPosition, ConnectionPositionPair } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { injectUiCopy, UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import { PopoverRef, PopoverService } from '@ui/popover';
import { LucideCheck, LucideEye, LucideEyeOff, LucideShield, LucideX } from '@lucide/angular';
import {
  PasswordAutocomplete,
  PasswordFeedback,
  PasswordInputSize,
  PasswordPanelPlacement,
  PasswordRule,
  PasswordRuleState,
  PasswordStrengthScorer,
} from './password-input.types';
import { DEFAULT_PASSWORD_RULES } from './password-rules';
import { defaultPasswordStrength, PASSWORD_STRENGTH_LEVELS } from './password-strength';

let nextUniqueId = 0;

/**
 * Reads the edge a landed overlay position sits on. A pane whose start edge meets the
 * anchor's end edge is beside the field, and the reverse for a flip to the other side.
 * Everything else stacks.
 */
function placementOf(landed: ConnectionPositionPair): PasswordPanelPlacement {
  if (landed.originX === 'end' && landed.overlayX === 'start') {
    return 'end';
  }
  if (landed.originX === 'start' && landed.overlayX === 'end') {
    return 'start';
  }
  return 'block';
}

/** Maps a strength score to the `passwordInput.strength.*` key that names it. */
const STRENGTH_NAMES = ['none', 'veryWeak', 'weak', 'fair', 'good', 'strong'] as const;

/** Idle time before the live region announces, so a burst of typing announces once. */
const ANNOUNCE_DELAY = 600;

/** Stacked under the field, flipping above it near the viewport bottom. */
const PANEL_POSITIONS: readonly ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
];

/** Gap between the field and a side panel. Matches the `--space-2` the stacked panel leaves. */
const SIDE_OFFSET = 8;

/**
 * Beside the field and top-aligned, on the end side first. The last two entries repeat
 * `PANEL_POSITIONS`: a viewport with no room beside the field must stack the panel rather
 * than let the CDK push it over the control.
 */
const SIDE_POSITIONS: readonly ConnectedPosition[] = [
  {
    originX: 'end',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'top',
    offsetX: SIDE_OFFSET,
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'top',
    offsetX: -SIDE_OFFSET,
  },
  ...PANEL_POSITIONS,
];

/**
 * Design-system password field: a masked input with an optional
 * reveal toggle, clear button, strength meter and requirements checklist.
 *
 * ```ts
 * import { PasswordInput } from '@ui/password-input';
 * ```
 *
 * One `PasswordRule[]` drives the checklist, the strength score and, through
 * `validatePassword`, the form's validity, so the three cannot disagree. A strong rating needs
 * every rule to pass.
 *
 * The control implements `FormValueControl`. Validation lives in the schema and not in the
 * control.
 *
 * ```ts
 * const signUpForm = form(model, (signUp) => {
 *   required(signUp.password);
 *   validatePassword(signUp.password);
 * });
 * ```
 * ```html
 * <lib-password-input [formField]="signUpForm.password" feedback="popover" />
 * ```
 *
 * In `feedback="popover"` and `feedback="side"` modes the panel opens on focus in a CDK
 * overlay and never takes focus, so typing continues. `side` places it beside the field
 * instead of under it, so it hides neither the field nor what follows it. A screen reader
 * gets the requirements through `aria-describedby` and a debounced polite summary. The
 * visual panel is `aria-hidden`, because it repeats both.
 */
@Component({
  selector: 'lib-password-input',
  templateUrl: './password-input.html',
  styleUrl: './password-input.scss',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    LucideCheck,
    LucideEye,
    LucideEyeOff,
    LucideShield,
    LucideX,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'passwordInput',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    // The filled contract that the float and IFTA label wrappers read.
    '[attr.data-filled]': 'value() ? "" : null',
    '(focusin)': 'onFocusin()',
    '(focusout)': 'onFocusout($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class PasswordInput implements FormValueControl<string> {
  /** The password as typed. It is `''` while empty. */
  readonly value = model('');

  /** Control size. Defaults to `md`. */
  readonly size = input<PasswordInputSize>('md');

  readonly placeholder = input('');

  /**
   * The `autocomplete` for the inner input. Use `new-password` on a sign-up or reset form, so
   * a password manager offers to generate one.
   */
  readonly autocomplete = input<PasswordAutocomplete>('current-password');

  /** Disables interaction. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Invalid styling. Bound automatically by `[formField]`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /** Touched state. Bound automatically by `[formField]`. */
  readonly touched = input(false, { transform: booleanAttribute });

  /** Required state. Bound automatically by `[formField]`. */
  readonly required = input(false, { transform: booleanAttribute });

  /** Field errors. Bound automatically by `[formField]`. */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Shows the reveal toggle. It is on by default and always hidden while disabled. */
  readonly showToggle = input(true, { transform: booleanAttribute });

  /** Shows a clear button once the field has a value. */
  readonly showClear = input(false, { transform: booleanAttribute });

  /**
   * Whether the password is unmasked. It is two-way, so one switch can reveal every field in
   * a form.
   */
  readonly revealed = model(false);

  /**
   * Where the strength meter and checklist render. Defaults to `none`. Use `side` when the
   * panel under the field would cover the rest of the form.
   */
  readonly feedback = input<PasswordFeedback>('none');

  /** Requirements the password is measured against. */
  readonly rules = input<readonly PasswordRule[]>(DEFAULT_PASSWORD_RULES);

  /** Includes the strength meter in the feedback panel. */
  readonly showStrength = input(true, { transform: booleanAttribute });

  /** Includes the requirements checklist in the feedback panel. */
  readonly showRequirements = input(true, { transform: booleanAttribute });

  /**
   * Rates the password. It defaults to `defaultPasswordStrength`, which scores against
   * `rules`. Replace it with an entropy or dictionary rating when a rule count is too blunt.
   */
  readonly strengthScorer = input<PasswordStrengthScorer>(defaultPasswordStrength);

  /** The `id` of the inner input, which makes an external `<label for>` work. */
  readonly inputId = input('');

  /** The `name` of the input, for autofill. Bound automatically by `[formField]`. */
  readonly name = input('');

  /**
   * The accessible name of the input. Without this and without a label through `inputId` or
   * `ariaLabelledby`, the control applies a translated generic Password label.
   */
  readonly ariaLabel = input('');

  /** The `id` of the element that labels the input, such as a float label. */
  readonly ariaLabelledby = input('');

  /** The ids that describe the input. The control appends its own ids. */
  readonly ariaDescribedby = input('');

  /** The accessible name of the reveal toggle. It defaults to a translated name. */
  readonly toggleAriaLabel = input('');

  /** The accessible name of the clear button. It defaults to a translated name. */
  readonly clearAriaLabel = input('');

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  private readonly uniqueId = nextUniqueId++;
  protected readonly requirementsId = `lib-password-input-req-${this.uniqueId}`;
  protected readonly errorId = `lib-password-input-error-${this.uniqueId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly popover = inject(PopoverService);
  private readonly transloco = inject(TranslocoService);
  private readonly copy = injectUiCopy();

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  /** Tracks blur for error display when used outside a form. */
  private readonly blurred = signal(false);

  /**
   * Gates the checklist entrance. `animate.enter` also fires on first paint, so without
   * this a pre-filled field pops every satisfied rule on load.
   */
  protected readonly typed = signal(false);

  /**
   * The open pane. It is a signal because `panelPlacement` reads `position()` through it:
   * off a plain field the read short-circuits before anything is open, and the effect
   * registers no dependency at all.
   */
  private readonly popoverRef = signal<PopoverRef | null>(null);

  /** The pane that still plays its exit. A reopen cuts the exit short. */
  private closingRef: PopoverRef | null = null;
  private exitingPanel: HTMLElement | null = null;

  /** Anchor width, sampled on open so the panel lines up with the field. */
  protected readonly panelWidth = signal(0);

  /**
   * The edge the pane landed on, which drives the entrance direction. It survives the close,
   * so the exit leaves the way it came in.
   */
  protected readonly panelPlacement = signal<PasswordPanelPlacement>('block');

  /** The debounced polite announcement. An empty value renders nothing. */
  protected readonly liveMessage = signal('');

  protected readonly strengthMeterVisible = computed(
    () => this.feedback() !== 'none' && this.showStrength(),
  );

  protected readonly requirementsVisible = computed(
    () => this.feedback() !== 'none' && this.showRequirements() && this.rules().length > 0,
  );

  protected readonly panelVisible = computed(
    () => this.strengthMeterVisible() || this.requirementsVisible(),
  );

  /** Whether the panel renders in an overlay rather than in flow. */
  protected readonly floating = computed(
    () => this.feedback() === 'popover' || this.feedback() === 'side',
  );

  /**
   * The panel matches the field's width only where it sits under it. A side panel takes its
   * own width, because a wide field would otherwise produce a panel that reaches the
   * viewport edge.
   */
  protected readonly panelMinWidth = computed(() =>
    this.feedback() === 'popover' ? this.panelWidth() : null,
  );

  protected readonly ruleStates = computed<readonly PasswordRuleState[]>(() => {
    const value = this.value();
    return this.rules().map((rule) => ({
      rule,
      // The Transloco pipe resolves this and re-renders when the lazy scope arrives.
      label: `passwordInput.rules.${rule.key}`,
      met: rule.test(value),
    }));
  });

  protected readonly score = computed(() => this.strengthScorer()(this.value(), this.rules()));

  protected readonly strengthKey = computed(
    () => `passwordInput.strength.${STRENGTH_NAMES[this.score()]}`,
  );

  protected readonly metCount = computed(
    () => this.ruleStates().filter((state) => state.met).length,
  );

  /**
   * One segment per requirement, so the meter reads as progress through the checklist beside
   * it. With no rules, a custom `strengthScorer` is in use, so it falls back to the rating
   * scale's own five levels.
   */
  protected readonly segments = computed(() =>
    Array.from(
      { length: this.rules().length || PASSWORD_STRENGTH_LEVELS },
      (_, index) => index + 1,
    ),
  );

  protected readonly litSegments = computed(() =>
    this.rules().length > 0 ? this.metCount() : this.score(),
  );

  protected readonly firstError = computed(() => this.errors().at(0));

  /** An error shows only after a touch, so a pre-filled invalid value never flashes one. */
  protected readonly showError = computed(
    () => (this.touched() || this.blurred()) && !!this.firstError(),
  );

  /**
   * The translation key for the current error. The `required` kind and the
   * `password.<ruleKey>` kinds from `validatePassword` map to shipped messages. A custom rule
   * falls back to the generic message unless the error carries its own `message`.
   */
  protected readonly errorKey = computed(() => {
    const kind = this.firstError()?.kind ?? '';
    const known = kind === 'required' || kind.startsWith('password.');
    return `passwordInput.errors.${known ? kind : 'passwordInvalid'}`;
  });

  /** The interpolation parameters for the error message, such as `{ min: 12 }`. */
  protected readonly errorParams = computed(() => {
    const kind = this.firstError()?.kind ?? '';
    const key = kind.startsWith('password.') ? kind.slice('password.'.length) : '';
    return this.rules().find((rule) => rule.key === key)?.params ?? {};
  });

  protected readonly describedBy = computed(
    () =>
      [
        this.ariaDescribedby(),
        this.requirementsVisible() ? this.requirementsId : '',
        this.showError() ? this.errorId : '',
      ]
        .filter(Boolean)
        .join(' ') || null,
  );

  /**
   * What the live region holds once typing settles. It is empty before the lazy translations
   * arrive, because announcing a raw i18n key is worse than silence.
   */
  private readonly summary = computed(() => {
    // Resolve every string again when the language changes.
    this.lang();

    if (!this.value() || !this.panelVisible()) {
      return '';
    }

    const sentences: string[] = [];

    if (this.strengthMeterVisible()) {
      const strength = this.translate(this.strengthKey());
      if (!strength) {
        return '';
      }
      sentences.push(this.translate('passwordInput.announce.strength', { strength }));
    }

    if (this.requirementsVisible()) {
      const states = this.ruleStates();
      const unmet = states.filter((state) => !state.met);

      if (unmet.length === 0) {
        sentences.push(this.translate('passwordInput.announce.complete'));
      } else {
        sentences.push(
          this.translate('passwordInput.announce.progress', {
            met: states.length - unmet.length,
            total: states.length,
          }),
        );
        const separator = this.translate('passwordInput.announce.separator') || ', ';
        const missing = unmet
          .map((state) => state.rule.label ?? this.translate(state.label, state.rule.params))
          .join(separator);
        sentences.push(this.translate('passwordInput.announce.missing', { rules: missing }));
      }
    }

    return sentences.every(Boolean) ? sentences.join(' ') : '';
  });

  constructor() {
    claimFieldError();
    let announceTimer: ReturnType<typeof setTimeout> | undefined;

    // One announcement per burst of typing. The server schedules no timer, because `summary`
    // is empty while the value is empty, and nothing types during SSR.
    effect(() => {
      const summary = this.summary();
      clearTimeout(announceTimer);

      if (!summary) {
        this.liveMessage.set('');
        return;
      }
      announceTimer = setTimeout(() => {
        this.liveMessage.set(summary);
      }, ANNOUNCE_DELAY);
    });

    // The CDK decides a flip from the size at attach time, and the panel grows as rules pass.
    afterRenderEffect(() => {
      this.score();
      this.ruleStates();
      this.popoverRef()?.updatePosition();
    });

    // `positionChanges` is subscribed after the attach, so the first emission comes from the
    // reposition above. Until then the placement is the one `openPanel` asked for.
    effect(() => {
      const landed = this.popoverRef()?.position();
      if (landed) {
        this.panelPlacement.set(placementOf(landed));
      }
    });

    // A control the user cannot edit must not offer a floating panel.
    effect(() => {
      if (this.disabled()) {
        this.closePanel();
      }
    });

    inject(DestroyRef).onDestroy(() => {
      clearTimeout(announceTimer);
      // A pane that already closes disposes its own overlay, so only the open one is here.
      this.cutPanelExitShort();
      this.popoverRef()?.dispose();
      this.popoverRef.set(null);
    });
  }

  /** Signal Forms focuses the control through this on submit errors. */
  focus(options?: FocusOptions): void {
    this.inputRef().nativeElement.focus(options);
  }

  protected onInput(event: Event): void {
    this.typed.set(true);
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected toggleReveal(): void {
    if (this.disabled()) {
      return;
    }
    // Focus stays on the toggle. Moving the caret back loses the user's place.
    this.revealed.update((revealed) => !revealed);
  }

  protected clear(): void {
    if (this.disabled()) {
      return;
    }
    this.value.set('');
    this.inputRef().nativeElement.focus();
  }

  protected onFocusin(): void {
    this.openPanel();
  }

  protected onFocusout(event: FocusEvent): void {
    // A move to the control's own buttons is not a blur, and the panel survives it.
    const next = event.relatedTarget as Node | null;
    if (this.host.nativeElement.contains(next)) {
      return;
    }
    this.blurred.set(true);
    this.closePanel();
    this.touch.emit();
  }

  protected onEscape(event: Event): void {
    // Swallow Escape only while the panel is open, so it still reaches a surrounding dialog.
    if (!this.popoverRef()) {
      return;
    }
    event.stopPropagation();
    this.closePanel();
  }

  private openPanel(): void {
    if (this.popoverRef() || !this.floating() || this.disabled() || !this.panelVisible()) {
      return;
    }

    // A pane in mid-exit sits on top of the new one, so end it now.
    this.cutPanelExitShort();

    const side = this.feedback() === 'side';
    this.panelWidth.set(this.host.nativeElement.offsetWidth);
    this.panelPlacement.set(side ? 'end' : 'block');
    this.popoverRef.set(
      this.popover.open({
        anchor: this.host,
        template: this.panelTemplate(),
        viewContainerRef: this.viewContainerRef,
        positions: side ? SIDE_POSITIONS : PANEL_POSITIONS,
        scrollBehavior: 'reposition',
        // The reveal and clear buttons sit outside the pane, so outside-dismissal closes the
        // panel as soon as either is used.
        dismissOnOutsidePointer: false,
        // The pane never holds focus, so the host handles Escape.
        dismissOnEscape: false,
        beforeDispose: () => this.animatePanelOut(),
      }),
    );
  }

  /**
   * Hands the pane to `closingRef` for its exit, so `popoverRef` reads as closed while the
   * exit plays. Escape stops swallowing, and a refocus can open a fresh panel.
   */
  private closePanel(): void {
    const ref = this.popoverRef();
    if (!ref) {
      return;
    }
    this.popoverRef.set(null);
    this.closingRef = ref;
    void ref.close().then(() => {
      if (this.closingRef === ref) {
        this.closingRef = null;
      }
    });
  }

  /**
   * Ends an in-flight exit now. Finishing the animations resolves what `animatePanelOut`
   * awaits, so the pending `close()` disposes its own overlay.
   *
   * CAUTION: Do not call `dispose()` here as well. A `PopoverRef` cannot be disposed twice,
   * because `overlayElement` is null the second time.
   */
  private cutPanelExitShort(): void {
    const panel = this.exitingPanel;
    this.exitingPanel = null;
    if (!panel) {
      return;
    }
    for (const animation of panel.getAnimations()) {
      animation.finish();
    }
  }

  /**
   * Plays the panel exit before teardown. Awaiting the element's own animations also covers
   * reduced motion, because the global guard collapses them to 0.01ms.
   */
  private async animatePanelOut(): Promise<void> {
    const panel = this.closingRef?.overlayElement.querySelector<HTMLElement>('.password-panel');
    if (!panel) {
      return;
    }
    panel.classList.add('password-panel-leave');

    let animations: readonly Animation[];
    try {
      animations = panel.getAnimations();
    } catch {
      // jsdom has no Web Animations API, whatever the DOM types say.
      return;
    }
    if (animations.length === 0) {
      return;
    }

    this.exitingPanel = panel;
    try {
      await Promise.all(
        // A cancelled animation rejects. That is teardown, and it means stop waiting.
        animations.map((animation) => animation.finished.catch(() => undefined)),
      );
    } finally {
      if (this.exitingPanel === panel) {
        this.exitingPanel = null;
      }
    }
  }

  /** Translates the key through `uiCopy`, or returns `''` when the lazy scope has not arrived. */
  private translate(key: string, params?: Record<string, string | number>): string {
    const resolved = this.copy(key);
    const translated = this.transloco.translate(resolved, params);
    return translated === resolved ? '' : translated;
  }
}
