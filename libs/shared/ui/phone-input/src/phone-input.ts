import {
  afterNextRender,
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
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import type { IntlTelInputInterface, Iso2, Iti, NumberType, UiTranslations } from 'intl-tel-input';
import { PHONE_ERROR_KINDS, PhoneInputSize, PhoneNumberKind } from './phone-input.types';
import { allowedNumberTypes } from './phone-validation';

let nextUniqueId = 0;

/**
 * Design-system phone number input built on `intl-tel-input`: country selector with flags
 * and search, as-you-type formatting, example-number placeholders. The runtime, the
 * libphonenumber utils (~250 kB) and the selector translations all load lazily on first
 * render, so none of it weighs on the initial bundle.
 *
 * ```ts
 * import { PhoneInput } from '@ui/phone-input';
 * ```
 *
 * The `value` is E.164 (`"+306912345678"`); country names follow the active Transloco
 * language via `Intl.DisplayNames`.
 *
 * Implements `FormValueControl`. Validation lives in the schema via `validatePhone`; the
 * errors flow back into `errors` and render as a translated message once touched:
 *
 * ```ts
 * const bookingForm = form(model, (booking) => {
 *   required(booking.phone);
 *   validatePhone(booking.phone, PHONE_CONFIG);
 * });
 * ```
 * ```html
 * <lib-phone-input [formField]="bookingForm.phone" [config]="PHONE_CONFIG" />
 * ```
 */
@Component({
  selector: 'lib-phone-input',
  templateUrl: './phone-input.html',
  // Styles live in the global 7-1 system because they must reach the DOM intl-tel-input
  // injects at runtime, which emulated encapsulation cannot.
  imports: [TranslocoPipe, UiCopyPipe],
  providers: [
    provideTranslocoScope({
      scope: 'phoneInput',
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
    // Filled contract consumed by the float/IFTA label wrappers.
    '[attr.data-filled]': 'value() ? "" : null',
    '(focusout)': 'onFocusout($event)',
  },
})
export class PhoneInput implements FormValueControl<string> {
  /** The number in international E.164 form; `''` while empty. */
  readonly value = model('');

  /** Country the number is read against. Follows the selector; writing it switches. */
  readonly country = model<Iso2 | undefined>(undefined);

  /**
   * Country shown before the user picks one or a value implies one. A fallback only —
   * `country` takes precedence, so set that to steer a live control.
   */
  readonly initialCountry = input<Iso2>('gr');

  /**
   * Number kinds this usage accepts, driving the example placeholder. Enforcement is in
   * the schema, via `validatePhone` with the same setting.
   */
  readonly allowedTypes = input<PhoneNumberKind>('any');

  /** Number type of the example placeholder. Defaults to `MOBILE`. */
  readonly placeholderNumberType = input<NumberType>('MOBILE');

  /** Control size. Defaults to `md`. */
  readonly size = input<PhoneInputSize>('md');

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

  /** `id` for the input, so an external `<label for>` can reference it. */
  readonly inputId = input('');

  /** `name` for the input (autofill). Bound automatically by `[formField]`. */
  readonly name = input('');

  /** Accessible name. Falls back to a translated "Phone number" when no label is bound. */
  readonly ariaLabel = input('');

  /** `id` of the element that labels the input (e.g. a float label). */
  readonly ariaLabelledby = input('');

  /** Describing `id`(s). Composed with, never replacing, this control's own error id. */
  readonly ariaDescribedby = input('');

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  /** True once intl-tel-input and its utils are ready. */
  protected readonly initialized = signal(false);

  /** Tracks blur for error display when used outside a form. */
  private readonly blurred = signal(false);

  protected readonly errorId = `lib-phone-input-error-${nextUniqueId++}`;

  private readonly transloco = inject(TranslocoService);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly telInput = viewChild.required<ElementRef<HTMLInputElement>>('tel');

  private intlTelInput?: IntlTelInputInterface;
  private iti?: Iti;
  /** `initKey` of the instance currently attached, if any. */
  private appliedInitKey?: string;
  /** Bumped per `init()` so a superseded run can bail at its awaits. */
  private initGeneration = 0;
  private destroyed = false;
  /** Last value this component emitted, to break write-back loops. */
  private lastEmitted?: string;

  /**
   * intl-tel-input reads these at construction and offers no setters, so changing one has
   * to rebuild the instance. Joined into one key so a single effect covers them all.
   */
  private readonly initKey = computed(() => [this.lang(), this.allowedTypes()].join('|'));

  protected readonly firstError = computed(() => this.errors().at(0));

  /**
   * Errors show once touched, and never before init finishes — so a pre-filled invalid
   * value does not flash an error on first paint.
   */
  protected readonly showError = computed(
    () => this.initialized() && (this.touched() || this.blurred()) && !!this.firstError(),
  );

  /**
   * The consumer's `ariaDescribedby` plus our error id — appended, never substituted, so
   * binding your own hint does not silence this control's message.
   */
  protected readonly describedBy = computed(() => {
    const ids = [this.ariaDescribedby(), this.showError() ? this.errorId : ''];
    return ids.filter(Boolean).join(' ') || null;
  });

  /**
   * Translation key for the current error. Known kinds (`required` included) map to
   * shipped messages; anything else falls back unless the error carries a `message`.
   */
  protected readonly errorKey = computed(() => {
    const kind = this.firstError()?.kind ?? '';
    const known = kind === 'required' || (PHONE_ERROR_KINDS as readonly string[]).includes(kind);
    return `phoneInput.errors.${known ? kind : 'phoneInvalid'}`;
  });

  constructor() {
    claimFieldError();
    afterNextRender(() => void this.init());

    // All construction-time options, so any change rebuilds the instance. Value and
    // country survive the swap.
    effect(() => {
      const key = this.initKey();
      if (this.iti && key !== this.appliedInitKey) {
        void this.init();
      }
    });

    // This one the plugin can change in place.
    effect(() => {
      const type = this.placeholderNumberType();
      if (this.iti && this.initialized()) {
        this.iti.setPlaceholderNumberType(type);
      }
    });

    // Value written from outside (form seed/reset) → hand to the plugin.
    effect(() => {
      const value = this.value();
      if (this.iti && this.initialized() && value !== this.lastEmitted) {
        this.lastEmitted = value;
        this.iti.setNumber(value);
      }
    });

    // Country written from outside → switch the selector.
    effect(() => {
      const country = this.country();
      if (
        this.iti &&
        this.initialized() &&
        country &&
        country !== this.iti.getSelectedCountry()?.iso2
      ) {
        this.iti.setSelectedCountry(country);
      }
    });

    effect(() => {
      const disabled = this.disabled();
      if (this.iti && this.initialized()) {
        this.iti.setDisabled(disabled);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      // An in-flight init checks this before constructing, so teardown cannot miss one.
      this.destroyed = true;
      this.iti?.destroy();
      this.iti = undefined;
    });
  }

  /** Whether a newer `init()` run, or destruction, has taken over. */
  private isStale(generation: number): boolean {
    return this.destroyed || generation !== this.initGeneration;
  }

  /**
   * (Re)builds the plugin instance, on first render and on every language switch — so
   * several runs can be in flight. Each carries a generation and abandons itself at its
   * awaits once a newer run starts or the component is destroyed. Without that, a slow
   * first run finishing last leaves the instance describing the wrong language, or
   * attaches one that nothing will ever destroy.
   */
  private async init(): Promise<void> {
    const generation = ++this.initGeneration;
    const key = this.initKey();
    const lang = this.lang();
    const [intlTelInputModule, uiTranslations] = await Promise.all([
      import('intl-tel-input'),
      this.loadUiTranslations(lang),
    ]);
    if (this.isStale(generation)) {
      return;
    }
    this.intlTelInput = intlTelInputModule.default;

    const inputEl = this.telInput().nativeElement;
    this.initialized.set(false);
    this.iti?.destroy();
    // Seed before init so the plugin derives the country from the value.
    inputEl.value = this.value();
    // `destroy()` leaves the old example number behind, and the plugin's "polite" policy
    // refuses to overwrite a placeholder it thinks the consumer set — so a rebuild would
    // keep the old country's example. We never set one in the template, so this is ours.
    inputEl.removeAttribute('placeholder');
    this.appliedInitKey = key;
    // Published synchronously after the staleness check, so destruction always finds it.
    this.iti = this.intlTelInput(inputEl, {
      // A `country` in hand outranks the `initialCountry` fallback. A seeded value beats
      // both, since the plugin derives the country from its dial code.
      initialCountry: this.country() ?? this.initialCountry(),
      loadUtils: () => import('intl-tel-input/utils'),
      allowedNumberTypes: allowedNumberTypes(this.allowedTypes()),
      placeholderNumberType: this.placeholderNumberType(),
      countryNameLocale: lang,
      uiTranslations,
    });
    await this.iti.promise;

    // A newer run, or destruction, already owns the state below.
    if (this.isStale(generation)) {
      return;
    }

    if (this.disabled()) {
      this.iti.setDisabled(true);
    }
    // Normalize a seeded value to E.164; the schema revalidates now utils are loaded.
    const number = this.iti.getNumber();
    if (number && number !== this.value()) {
      this.lastEmitted = number;
      this.value.set(number);
    }
    this.country.set(this.iti.getSelectedCountry()?.iso2);
    this.initialized.set(true);
  }

  /** Selector UI strings (search placeholder, ARIA labels) per language. */
  private async loadUiTranslations(lang: string): Promise<UiTranslations> {
    // The per-locale files default-export UiTranslations; the types only describe the index.
    const localeModule = (lang === 'el'
      ? await import('intl-tel-input/locale/el')
      : await import('intl-tel-input/locale/en')) as unknown as { default: UiTranslations };
    return localeModule.default;
  }

  protected onInput(): void {
    if (!this.iti) {
      return;
    }
    const raw = this.telInput().nativeElement.value;
    this.emit(raw.trim() ? this.toInternational(raw) : '');
  }

  protected onCountryChange(): void {
    if (this.iti && this.initialized()) {
      this.country.set(this.iti.getSelectedCountry()?.iso2);
      // Reinterpret what's typed against the newly selected country.
      this.onInput();
    }
  }

  /**
   * The plugin returns `+…` for anything parseable and raw text for partial national
   * input, which we prefix with the selected dial code so the value stays self-describing.
   */
  private toInternational(raw: string): string {
    const iti = this.iti;
    if (!iti) {
      return raw;
    }
    const number = iti.getNumber().trim();
    if (number.startsWith('+')) {
      return number;
    }
    const country = iti.getSelectedCountry();
    if (!country) {
      return number || raw;
    }
    const core =
      this.intlTelInput?.utils?.getCoreNumber(raw, country.iso2) ?? raw.replace(/\D/g, '');
    return `+${country.dialCode}${core}`;
  }

  private emit(value: string): void {
    if (value !== this.value()) {
      this.lastEmitted = value;
      this.value.set(value);
    }
  }

  protected onFocusout(event: FocusEvent): void {
    const target = event.relatedTarget as HTMLElement | null;
    const host = event.currentTarget as HTMLElement | null;
    // The mobile fullscreen selector attaches to <body>; focus there is not a blur.
    if (!host?.contains(target) && !target?.closest('.iti')) {
      this.blurred.set(true);
      this.touch.emit();
    }
  }

  /** Signal Forms focuses the control through this on submit errors. */
  focus(options?: FocusOptions): void {
    this.telInput().nativeElement.focus(options);
  }
}
