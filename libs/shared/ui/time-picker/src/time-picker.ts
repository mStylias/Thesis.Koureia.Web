import {
  booleanAttribute,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  linkedSignal,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import { LucideChevronDown, LucideClock3, LucideX } from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import {
  ExcludedTimeDisplay,
  TimeConstraints,
  TimePickerMode,
  TimePickerSize,
  TimeRange,
  TimeValue,
} from './time-picker.types';
import { createTimeSlots, isTimeAllowed, normalizeTime } from './time-picker.utils';

/** Gap between one inline tile's entrance and the next. */
const TILE_STAGGER_STEP_MS = 15;

/** How many tiles the stagger reaches before every later one shares the last delay. */
const TILE_STAGGER_LIMIT = 6;

let nextUniqueId = 0;

const CLOCK_HOURS = [
  { label: '12', left: 50, top: 12 },
  { label: '1', left: 69, top: 17 },
  { label: '2', left: 83, top: 31 },
  { label: '3', left: 88, top: 50 },
  { label: '4', left: 83, top: 69 },
  { label: '5', left: 69, top: 83 },
  { label: '6', left: 50, top: 88 },
  { label: '7', left: 31, top: 83 },
  { label: '8', left: 17, top: 69 },
  { label: '9', left: 12, top: 50 },
  { label: '10', left: 17, top: 31 },
  { label: '11', left: 31, top: 17 },
] as const;

/**
 * Accessible time entry for appointment flows. `dropdown` presents an
 * editable combobox; `inline` lays the same slots out as a visible listbox;
 * `clock` adds a read-only analog display above that listbox.
 * Values are canonical 24-hour `HH:mm` strings and bind directly to Signal
 * Forms through `FormValueControl<string>`.
 */
@Component({
  selector: 'lib-time-picker',
  imports: [
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    Listbox,
    Option,
    LucideChevronDown,
    LucideClock3,
    LucideX,
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'timePicker',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  templateUrl: './time-picker.html',
  styleUrl: './time-picker.scss',
  host: {
    '[attr.data-mode]': 'mode()',
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-invalid]': 'isInvalid() ? "" : null',
    '[attr.data-filled]': 'value() ? "" : null',
    '[attr.data-show-clock]': 'showClock() ? "" : null',
    '(focusout)': 'onFocusout($event)',
  },
})
export class TimePicker implements FormValueControl<string> {
  /** Canonical `HH:mm`; empty string means no selection. */
  readonly value = model<TimeValue>('');
  /** `dropdown` is editable, `inline` shows slots, and `clock` adds an analog display. */
  readonly mode = input<TimePickerMode>('dropdown');
  /** Shows a read-only analog face above the time control. */
  readonly showClock = input(false, { transform: booleanAttribute });
  /** Minutes between generated slots; ignored when `validTimes` is supplied. */
  readonly interval = input(30, { transform: numberAttribute });
  /** Earliest selectable time, inclusive. */
  readonly min = input<TimeValue | undefined>('00:00');
  /** Latest selectable time, inclusive. */
  readonly max = input<TimeValue | undefined>('23:59');
  /** If non-empty, only these exact times are offered and selectable. */
  readonly validTimes = input<readonly TimeValue[]>([]);
  /** If non-empty, values must fall inside at least one of these half-open ranges. */
  readonly includedRanges = input<readonly TimeRange[]>([]);
  /** Half-open ranges of unavailable times. */
  readonly excludedRanges = input<readonly TimeRange[]>([]);
  /** Exact unavailable times. */
  readonly excludedTimes = input<readonly TimeValue[]>([]);
  /** Whether unavailable slots stay visible and disabled, or are removed. */
  readonly excludedDisplay = input<ExcludedTimeDisplay>('disabled');
  /** Field density. */
  readonly size = input<TimePickerSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Read-only keeps the slots readable but withholds every edit affordance. */
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  /** Overrides the translated placeholder. */
  readonly placeholder = input('');
  /** Id for the text field, or for the inline listbox. */
  readonly inputId = input('');
  readonly name = input('');
  readonly ariaLabel = input('');
  readonly ariaLabelledby = input('');
  /** Consumer description ids; the control appends its own error id. */
  readonly ariaDescribedby = input('');
  /** Whether a clear button appears once the field holds text. */
  readonly showClear = input(false, { transform: booleanAttribute });
  /** Overrides the translated name of the clear button. */
  readonly clearAriaLabel = input('');
  /** Emits once focus leaves the whole control. */
  readonly touch = output();

  protected readonly expanded = signal(false);
  /** Below the field, or above it when the room below would cut the list off. */
  protected readonly dropdownPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];
  protected readonly clockHours = CLOCK_HOURS;
  protected readonly draft = linkedSignal(() => this.value());
  protected readonly entryError = signal<'timeFormat' | 'timeUnavailable' | undefined>(undefined);
  protected readonly blurred = signal(false);
  protected readonly errorId = `lib-time-picker-error-${nextUniqueId++}`;

  private readonly timeInput = viewChild<ElementRef<HTMLInputElement>>('timeInput');
  private readonly inlineList = viewChild<ElementRef<HTMLElement>>('inlineList');
  private readonly panelElement = viewChild<ElementRef<HTMLElement>>('panelEl');
  private readonly dropdownList = viewChild<ElementRef<HTMLElement>>('dropdownList');

  /**
   * Hides the dropdown's active option until the keyboard enters the list. `ngListbox` always
   * makes one option active, and a ring on it reads as a choice the user did not make.
   */
  protected readonly navigated = linkedSignal({ source: this.expanded, computation: () => false });

  protected readonly constraints = computed<TimeConstraints>(() => ({
    min: this.min(),
    max: this.max(),
    validTimes: this.validTimes(),
    includedRanges: this.includedRanges(),
    excludedRanges: this.excludedRanges(),
    excludedTimes: this.excludedTimes(),
  }));

  protected readonly slots = computed(() => createTimeSlots(this.interval(), this.constraints()));

  protected readonly visibleSlots = computed(() => {
    const slots = this.slots().filter(
      (slot) => this.excludedDisplay() === 'disabled' || !slot.disabled,
    );
    if (this.mode() !== 'dropdown') {
      return slots;
    }
    const query = this.draft().trim();
    if (!query || query === this.value()) {
      return slots;
    }
    const digits = query.replace(/\D/g, '');
    return slots.filter((slot) => slot.value.replace(':', '').startsWith(digits));
  });

  protected readonly listboxValue = computed(() => (this.value() ? [this.value()] : []));
  protected readonly clockHourRotation = computed(() => {
    const [hour, minute] = this.timeParts();
    return `${(hour % 12) * 30 + minute / 2}deg`;
  });
  protected readonly clockMinuteRotation = computed(() => `${this.timeParts()[1] * 6}deg`);
  protected readonly firstError = computed(() => this.errors().at(0));
  protected readonly isInvalid = computed(() => this.invalid() || !!this.entryError());
  protected readonly showError = computed(
    () => !!this.entryError() || ((this.touched() || this.blurred()) && !!this.firstError()),
  );
  protected readonly errorKey = computed(() => {
    const kind = this.entryError() ?? this.firstError()?.kind;
    return kind === 'required' || kind === 'timeFormat' || kind === 'timeUnavailable'
      ? `timePicker.errors.${kind}`
      : 'timePicker.errors.timeUnavailable';
  });
  protected readonly describedBy = computed(
    () =>
      [this.ariaDescribedby(), this.showError() ? this.errorId : ''].filter(Boolean).join(' ') ||
      undefined,
  );

  constructor() {
    claimFieldError();
    // The field relays its keys to the list. Capture on the panel runs before the list's own
    // handler, which a template listener cannot.
    effect((onCleanup) => {
      const panel = this.panelElement()?.nativeElement;
      if (panel === undefined) {
        return;
      }
      const guard = (event: KeyboardEvent): void => {
        this.guardListKeydown(event);
      };
      panel.addEventListener('keydown', guard, { capture: true });
      onCleanup(() => {
        panel.removeEventListener('keydown', guard, { capture: true });
      });
    });
    effect(() => {
      const value = this.value();
      if (!value) {
        return;
      }
      const normalized = normalizeTime(value);
      if (normalized && normalized !== value) {
        this.value.set(normalized);
      }
    });
  }

  /**
   * The delay one inline tile waits before it arrives, in milliseconds.
   *
   * Capped, so the whole grid lands inside the 300ms an interface gets. A day can hold forty
   * slots, and an uncapped step would leave most of them behind an empty wait.
   */
  protected tileDelay(index: number): number {
    return Math.min(index, TILE_STAGGER_LIMIT) * TILE_STAGGER_STEP_MS;
  }

  protected onDraftChange(value: string): void {
    this.draft.set(value);
    this.entryError.set(undefined);
    this.openDropdown();
  }

  protected openDropdown(): void {
    if (!this.editable()) {
      return;
    }
    this.expanded.set(true);
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      queueMicrotask(() => {
        if (this.expanded()) {
          this.commitDraft();
        }
      });
    } else if (event.key === 'Escape') {
      this.draft.set(this.value());
      this.entryError.set(undefined);
    }
  }

  protected onSelectionChange(values: readonly string[]): void {
    const selected = values.at(0);
    // Re-checked here as well as on the option: a stale click must not commit
    // a value the control is no longer allowed to change.
    if (!selected || !this.editable() || !isTimeAllowed(selected, this.constraints())) {
      return;
    }
    this.value.set(selected);
    this.draft.set(selected);
    this.entryError.set(undefined);
    this.expanded.set(false);
    this.timeInput()?.nativeElement.focus();
  }

  protected toggle(): void {
    if (!this.editable()) {
      return;
    }
    this.expanded.update((open) => !open);
    this.timeInput()?.nativeElement.focus();
  }

  protected clear(): void {
    if (!this.editable()) {
      return;
    }
    this.value.set('');
    this.draft.set('');
    this.entryError.set(undefined);
    this.timeInput()?.nativeElement.focus();
  }

  protected onFocusout(event: FocusEvent): void {
    const target = event.relatedTarget as Node | null;
    const host = event.currentTarget as HTMLElement | null;
    if (host?.contains(target)) {
      return;
    }
    if (this.mode() === 'dropdown') {
      this.commitDraft();
      this.expanded.set(false);
    }
    this.blurred.set(true);
    this.touch.emit();
  }

  /** Focuses the text field, or the inline listbox. */
  focus(options?: FocusOptions): void {
    (this.timeInput()?.nativeElement ?? this.inlineList()?.nativeElement)?.focus(options);
  }

  /** Whether the control may still change its own value. */
  private editable(): boolean {
    return !this.disabled() && !this.readonly();
  }

  private commitDraft(): void {
    const raw = this.draft().trim();
    if (!this.editable()) {
      return;
    }
    if (!raw) {
      this.value.set('');
      this.entryError.set(undefined);
      return;
    }
    const normalized = normalizeTime(raw);
    // Text the control cannot honour leaves the canonical model empty, so a
    // consumer never reads a value the field is not showing.
    if (!normalized) {
      this.rejectDraft(raw, 'timeFormat');
      return;
    }
    if (!isTimeAllowed(normalized, this.constraints())) {
      this.rejectDraft(raw, 'timeUnavailable');
      return;
    }
    this.value.set(normalized);
    this.draft.set(normalized);
    this.entryError.set(undefined);
    this.expanded.set(false);
  }

  private guardListKeydown(event: KeyboardEvent): void {
    if (this.navigated() || event.target !== this.dropdownList()?.nativeElement) {
      return;
    }
    switch (event.key) {
      // The hidden active option is already the first one. Reveal it instead of moving past it.
      case 'ArrowDown':
        event.stopImmediatePropagation();
        this.navigated.set(true);
        break;
      // Nothing the user can see is active, so Enter commits the typed text instead.
      case 'Enter':
        event.stopImmediatePropagation();
        break;
      case 'ArrowUp':
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
        this.navigated.set(true);
        break;
    }
  }

  private timeParts(): [number, number] {
    const normalized = normalizeTime(this.value()) ?? '00:00';
    const [hour = '0', minute = '0'] = normalized.split(':');
    return [Number(hour), Number(minute)];
  }

  /**
   * `draft` is linked to `value`, so emptying the model would wipe the text
   * the error is about — rewrite it explicitly after the reset.
   */
  private rejectDraft(raw: string, kind: 'timeFormat' | 'timeUnavailable'): void {
    this.value.set('');
    this.draft.set(raw);
    this.entryError.set(kind);
  }
}
