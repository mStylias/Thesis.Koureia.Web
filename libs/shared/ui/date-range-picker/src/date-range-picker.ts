import { DOCUMENT } from '@angular/common';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  LOCALE_ID,
  model,
  OnDestroy,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import {
  LucideCalendarRange,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
} from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Button } from '@ui/button';
import {
  addDays,
  addMonths,
  createDateLocaleInfo,
  dateInMonth,
  dateToMonth,
  type DateValue,
  formatDate,
  formatMonthHeading,
  isCanonicalDate,
  type IsoWeekday,
  type MonthValue,
  parseIsoDate,
  parseLocalizedDate,
  todayLocal,
} from '@ui/date-picker';
import { type PopoverCloseReason, type PopoverRef, PopoverService } from '@ui/popover';
import { claimFieldError } from '@util/forms';
import { UiCopyPipe } from '@util/ui-copy';

import {
  checkDateRange,
  countRangeDays,
  createRangeMonth,
  EMPTY_DATE_RANGE,
  formatMonthName,
  formatRangeDate,
  isoWeekdayOf,
  orderDates,
  safeMaxDays,
} from './core/date-range';
import type {
  DateRangeConstraints,
  DateRangeErrorKind,
  DateRangePickerSize,
  DateRangePreset,
  DateRangeValue,
  RangeCalendarDay,
} from './date-range-picker.types';

const PANEL_POSITIONS: readonly ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

// The width below which the panel shows one month. The datetime picker stacks at the same width.
const NARROW_QUERY = '(max-width: 42rem)';

const DAY_KEYS: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

// How long after a drag its trailing click can arrive. Touch sends it after the release.
const DRAG_CLICK_WINDOW = 500;

// The month grid is three columns wide.
const MONTH_KEYS: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -3,
  ArrowDown: 3,
};

let nextUniqueId = 0;

/**
 * Two dates that bound a range: a "from" and a "to" field, and a calendar panel with presets.
 *
 * ```ts
 * import { DateRangePicker, DATE_RANGE_PRESETS, type DateRangeValue } from '@ui/date-range-picker';
 * ```
 *
 * ```html
 * <lib-date-range-picker [(value)]="range" [presets]="presets" [maxDays]="731" />
 * ```
 *
 * The fields take typed dates in the locale's numeric format and commit on Enter or when focus
 * leaves the control. The panel edits a draft: two clicks pick a range, and only Apply writes it.
 * A preset applies at once. Values are canonical `YYYY-MM-DD` strings, and the control binds to
 * Signal Forms through `FormValueControl<DateRangeValue>`.
 */
@Component({
  selector: 'lib-date-range-picker',
  imports: [
    Button,
    LucideCalendarRange,
    LucideChevronDown,
    LucideChevronLeft,
    LucideChevronRight,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [
    PopoverService,
    provideTranslocoScope({
      scope: 'dateRangePicker',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  templateUrl: './date-range-picker.html',
  styleUrl: './date-range-picker.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-invalid]': 'isInvalid() ? "" : null',
    '[attr.data-filled]': 'value().from || value().to ? "" : null',
    '(pointerdown)': 'onPointerDownInside()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class DateRangePicker implements FormValueControl<DateRangeValue>, OnDestroy {
  /** The range. Both dates empty means no range. */
  readonly value = model<DateRangeValue>(EMPTY_DATE_RANGE);
  /** Ranges offered beside the calendar, such as `DATE_RANGE_PRESETS`. None by default. */
  readonly presets = input<readonly DateRangePreset[]>([]);
  /** Earliest selectable date, inclusive. */
  readonly minDate = input<DateValue | undefined>(undefined);
  /** Latest selectable date, inclusive. */
  readonly maxDate = input<DateValue | undefined>(undefined);
  /** Longest range in days, both ends counted. No limit when omitted. */
  readonly maxDays = input<number | undefined>(undefined);
  /** Overrides "today" for tests and stories. Presets count from it. */
  readonly today = input<DateValue>('');
  /** BCP 47 locale. Defaults to the browser's first language after hydration. */
  readonly locale = input('');
  /** First calendar column. `auto` follows the locale. */
  readonly firstDayOfWeek = input<'auto' | IsoWeekday>('auto');
  /** Field density. */
  readonly size = input<DateRangePickerSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Read-only keeps the calendar readable but withholds every edit affordance. */
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  /** Id for the "from" field. One is generated when omitted. */
  readonly inputId = input('');
  /** Names the whole control. Overrides the translated default. */
  readonly ariaLabel = input('');
  readonly ariaLabelledby = input('');
  /** Consumer description ids. The control appends its own error id. */
  readonly ariaDescribedby = input('');
  /** Overrides the translated name of the "from" field. */
  readonly fromAriaLabel = input('');
  /** Overrides the translated name of the "to" field. */
  readonly toAriaLabel = input('');

  /** Emits once focus leaves the control and its panel. */
  readonly touch = output();

  protected readonly uid = nextUniqueId++;
  protected readonly fromId = `lib-date-range-picker-from-${this.uid}`;
  protected readonly toId = `lib-date-range-picker-to-${this.uid}`;
  protected readonly panelId = `lib-date-range-picker-panel-${this.uid}`;
  protected readonly errorId = `lib-date-range-picker-error-${this.uid}`;
  protected readonly summaryId = `lib-date-range-picker-summary-${this.uid}`;

  protected readonly fromDraft = signal('');
  protected readonly toDraft = signal('');
  protected readonly entryError = signal<DateRangeErrorKind | undefined>(undefined);
  protected readonly blurred = signal(false);

  // The panel's draft. Nothing here reaches `value` before Apply or a preset.
  protected readonly draftFrom = signal<DateValue>('');
  protected readonly draftTo = signal<DateValue>('');
  protected readonly draftPreset = signal<string | null>(null);
  /** A first click waiting for its second. */
  protected readonly anchor = signal<DateValue>('');
  /** The day under the pointer or focus while `anchor` waits. */
  protected readonly preview = signal<DateValue>('');
  protected readonly firstMonth = signal<MonthValue>(todayLocal().slice(0, 7));
  protected readonly focusedDate = signal<DateValue>(todayLocal());
  protected readonly monthCount = signal<1 | 2>(2);
  /** `days` shows the calendar. `months` shows the twelve months of `viewYear` in its place. */
  protected readonly view = signal<'days' | 'months'>('days');
  protected readonly viewYear = signal(0);
  /** The column whose heading opened the month grid. The month picked there lands in it. */
  protected readonly viewColumn = signal(0);

  private readonly popoverRef = signal<PopoverRef | null>(null);
  private readonly defaultToday = signal(todayLocal());
  private readonly detectedLocale: ReturnType<typeof signal<string>>;
  private editing = false;
  /** The last value this control wrote. Any other value came from the consumer. */
  private written: DateRangeValue | null = null;
  private focusSession = false;
  private pointerDownInside = false;
  // A drag starts on a pressed day and becomes one when the pointer reaches another day.
  private dragOrigin: DateValue = '';
  private dragging = false;
  /**
   * Until when a click is the end of a drag, not a click. Touch fires it on the first day after
   * the release. A mouse drag fires it on the row or the table instead, so no day ever consumes
   * it: a flag would then swallow a later click without a press, which is how a screen reader
   * clicks.
   */
  private suppressClickUntil = 0;

  private readonly document = inject(DOCUMENT);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly popover = inject(PopoverService);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly fromInput = viewChild.required<ElementRef<HTMLInputElement>>('fromInput');
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  protected readonly isOpen = computed(() => this.popoverRef() !== null);
  protected readonly editable = computed(() => !this.disabled() && !this.readonly());
  protected readonly resolvedLocale = computed(() => this.locale().trim() || this.detectedLocale());
  protected readonly resolvedToday = computed(() =>
    isCanonicalDate(this.today()) ? this.today() : this.defaultToday(),
  );
  protected readonly localeInfo = computed(() =>
    createDateLocaleInfo(this.resolvedLocale(), this.firstDayOfWeek()),
  );
  protected readonly constraints = computed<DateRangeConstraints>(() => ({
    min: this.minDate(),
    max: this.maxDate(),
    maxDays: safeMaxDays(this.maxDays()),
  }));
  protected readonly months = computed(() =>
    Array.from({ length: this.monthCount() }, (_, index) =>
      createRangeMonth({
        month: addMonths(this.firstMonth(), index),
        headingId: `lib-date-range-picker-month-${String(this.uid)}-${String(index)}`,
        localeInfo: this.localeInfo(),
        constraints: this.constraints(),
        today: this.resolvedToday(),
        range: { from: this.draftFrom(), to: this.draftTo() },
        anchor: this.anchor(),
        preview: this.preview(),
      }),
    ),
  );
  protected readonly canGoPrevious = computed(() => {
    const minMonth = dateToMonth(this.minDate() ?? '');
    return !minMonth || addMonths(this.firstMonth(), -1) >= minMonth;
  });
  protected readonly canGoNext = computed(() => {
    const maxMonth = dateToMonth(this.maxDate() ?? '');
    return !maxMonth || addMonths(this.firstMonth(), this.monthCount()) <= maxMonth;
  });
  /** The twelve months of `viewYear`, with the one shown in `viewColumn` marked. */
  protected readonly monthOptions = computed(() => {
    const year = String(this.viewYear()).padStart(4, '0');
    const shown = addMonths(this.firstMonth(), this.viewColumn());
    const locale = this.localeInfo().locale;
    return Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, '0')}`;
      return {
        month,
        name: formatMonthName(month, locale),
        label: formatMonthHeading(month, locale),
        selected: month === shown,
        disabled: !this.monthAllowed(month),
      };
    });
  });
  protected readonly canGoPreviousYear = computed(() =>
    this.monthAllowed(`${String(this.viewYear() - 1).padStart(4, '0')}-12`),
  );
  protected readonly canGoNextYear = computed(() =>
    this.monthAllowed(`${String(this.viewYear() + 1).padStart(4, '0')}-01`),
  );
  /** Each preset with the dates it gives today and whether the limits allow it. */
  protected readonly presetOptions = computed(() =>
    this.presets().map((preset) => {
      const dates = preset.resolve(this.resolvedToday());
      return {
        preset,
        dates,
        disabled: checkDateRange(dates, this.constraints()) !== undefined,
      };
    }),
  );
  protected readonly draftComplete = computed(
    () => this.anchor() === '' && this.draftFrom() !== '' && this.draftTo() !== '',
  );
  protected readonly draftDays = computed(() => countRangeDays(this.draftFrom(), this.draftTo()));
  protected readonly draftLabel = computed(() => {
    const locale = this.localeInfo().locale;
    return `${formatRangeDate(this.draftFrom(), locale)} – ${formatRangeDate(this.draftTo(), locale)}`;
  });

  protected readonly firstError = computed(() => this.errors().at(0));
  protected readonly isInvalid = computed(() => this.invalid() || this.entryError() !== undefined);
  protected readonly showError = computed(
    () =>
      this.entryError() !== undefined ||
      ((this.touched() || this.blurred()) && this.firstError() !== undefined),
  );
  protected readonly errorKey = computed(() => {
    const kind = this.entryError() ?? this.firstError()?.kind;
    const known: readonly string[] = [
      'required',
      'dateFormat',
      'dateUnavailable',
      'rangeOrder',
      'rangeTooLong',
    ];
    return `dateRangePicker.errors.${kind !== undefined && known.includes(kind) ? kind : 'dateFormat'}`;
  });
  protected readonly describedBy = computed(
    () =>
      [this.ariaDescribedby(), this.showError() ? this.errorId : ''].filter(Boolean).join(' ') ||
      null,
  );

  constructor() {
    claimFieldError();
    const transloco = inject(TranslocoService);
    this.detectedLocale = signal(transloco.getActiveLang() || inject(LOCALE_ID) || 'el-GR');

    afterNextRender(() => {
      const view = this.document.defaultView;
      const browserLocale = view?.navigator.languages[0];
      if (browserLocale) this.detectedLocale.set(browserLocale);
      this.defaultToday.set(todayLocal());
      this.watchWidth(view);
    });

    // The fields follow the value, except while the user types and after a refused entry: that
    // empties the value, and the text it refused must stay on screen beside its error.
    effect(() => {
      const value = this.value();
      const locale = this.localeInfo().locale;
      untracked(() => {
        const own = value === this.written;
        if (!own) this.entryError.set(undefined);
        if (this.editing || (own && this.entryError() !== undefined)) return;
        this.fromDraft.set(formatDate(value.from, locale));
        this.toDraft.set(formatDate(value.to, locale));
      });
    });
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.stopDrag();
    this.popoverRef()?.dispose();
  }

  /** Focuses the "from" field. */
  focus(options?: FocusOptions): void {
    this.fromInput().nativeElement.focus(options);
  }

  protected onFieldInput(field: 'from' | 'to', event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.editing = true;
    this.entryError.set(undefined);
    (field === 'from' ? this.fromDraft : this.toDraft).set(text);
  }

  protected onFieldKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.commitTyped();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openPanel();
    }
  }

  protected togglePanel(): void {
    if (this.isOpen()) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  protected previousMonth(): void {
    if (this.canGoPrevious() && !this.disabled()) this.shiftMonths(-1);
  }

  protected nextMonth(): void {
    if (this.canGoNext() && !this.disabled()) this.shiftMonths(1);
  }

  protected selectPreset(option: { preset: DateRangePreset; disabled: boolean }): void {
    if (!this.editable() || option.disabled) return;
    this.write({ preset: option.preset.id, ...option.preset.resolve(this.resolvedToday()) });
    this.entryError.set(undefined);
    this.closePanel(true);
  }

  protected onDayClick(day: RangeCalendarDay): void {
    if (Date.now() < this.suppressClickUntil) {
      this.suppressClickUntil = 0;
      return;
    }
    this.selectDay(day);
  }

  /**
   * Starts a possible drag. Nothing changes until the pointer reaches another day, so a press
   * and release on one day stays a click. The listeners are on the document because touch
   * captures the pointer to the first day and the release can land outside the panel.
   */
  protected onDayPointerDown(day: RangeCalendarDay, event: PointerEvent): void {
    this.suppressClickUntil = 0;
    if (event.button !== 0 || !this.editable() || day.disabled) return;
    this.stopDrag();
    this.dragOrigin = day.date;
    this.document.addEventListener('pointermove', this.onDragMove);
    this.document.addEventListener('pointerup', this.onDragEnd);
    this.document.addEventListener('pointercancel', this.onDragCancel);
  }

  protected openMonthView(column: number): void {
    if (this.disabled()) return;
    const month = addMonths(this.firstMonth(), column);
    this.viewColumn.set(column);
    this.viewYear.set(Number(month.slice(0, 4)));
    this.view.set('months');
    this.focusInPanel(`[data-month="${month}"]`);
  }

  protected shiftYear(amount: number): void {
    this.viewYear.update((year) => year + amount);
  }

  protected pickMonth(option: { month: MonthValue; disabled: boolean }): void {
    if (option.disabled) return;
    this.firstMonth.set(addMonths(option.month, -this.viewColumn()));
    const day = parseIsoDate(this.focusedDate())?.day ?? 1;
    this.focusedDate.set(dateInMonth(option.month, day));
    this.closeMonthView();
  }

  /** Arrows move through the month grid, across years at its edges. */
  protected onMonthKeydown(event: KeyboardEvent, month: MonthValue): void {
    const step = MONTH_KEYS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const target = addMonths(month, step);
    this.viewYear.set(Number(target.slice(0, 4)));
    this.focusInPanel(`[data-month="${target}"]`);
  }

  /** Escape leaves the month grid first, then the panel. */
  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    // The key is the panel's: an enclosing dialog must not close with it.
    event.stopPropagation();
    if (this.view() === 'months') {
      this.closeMonthView();
      return;
    }
    void this.popoverRef()?.close('escape');
  }

  private selectDay(day: RangeCalendarDay): void {
    if (!this.editable() || day.disabled || !day.inCurrentMonth) return;
    this.focusedDate.set(day.date);
    this.draftPreset.set(null);
    const anchor = this.anchor();
    if (anchor === '') {
      this.anchor.set(day.date);
      this.preview.set(day.date);
      this.draftFrom.set('');
      this.draftTo.set('');
      return;
    }
    const range = orderDates(anchor, day.date);
    this.draftFrom.set(range.from);
    this.draftTo.set(range.to);
    this.anchor.set('');
    this.preview.set('');
  }

  protected onDayEnter(day: RangeCalendarDay): void {
    if (this.anchor() !== '' && !day.disabled) this.preview.set(day.date);
  }

  protected onDayFocus(day: RangeCalendarDay): void {
    this.focusedDate.set(day.date);
    this.onDayEnter(day);
  }

  protected onCalendarKeydown(event: KeyboardEvent): void {
    const focused = this.focusedDate();
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const day = this.findDay(focused);
      if (day) this.selectDay(day);
      return;
    }

    let target: DateValue | undefined;
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      const months = (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1);
      const month = addMonths(focused.slice(0, 7), months);
      target = dateInMonth(month, parseIsoDate(focused)?.day ?? 1);
    } else if (event.key === 'Home' || event.key === 'End') {
      const offset = (isoWeekdayOf(focused) - this.localeInfo().firstDayOfWeek + 7) % 7;
      target = addDays(focused, event.key === 'Home' ? -offset : 6 - offset);
    } else {
      const step = DAY_KEYS[event.key];
      if (step !== undefined) target = addDays(focused, step);
    }
    if (target === undefined) return;
    event.preventDefault();
    if (!this.monthAllowed(target.slice(0, 7))) return;
    this.revealMonth(target.slice(0, 7));
    this.focusedDate.set(target);
    this.focusDay(target);
  }

  protected apply(): void {
    if (!this.editable() || !this.draftComplete()) return;
    this.write({ preset: this.draftPreset(), from: this.draftFrom(), to: this.draftTo() });
    this.entryError.set(undefined);
    this.closePanel(true);
  }

  protected cancel(): void {
    this.closePanel(true);
  }

  protected onFocusIn(): void {
    this.focusSession = true;
  }

  protected onPointerDownInside(): void {
    this.pointerDownInside = true;
    setTimeout(() => {
      this.pointerDownInside = false;
    });
  }

  /**
   * A month change re-renders the panel, and Chrome fires `focusout` for a focused day that is
   * removed. Focus then sits on `<body>`, which reads as leaving. A removed target is a re-render,
   * not the user, so it never closes the panel.
   */
  protected onFocusOut(event: FocusEvent): void {
    const target = event.target;
    queueMicrotask(() => {
      if (target instanceof Node && !target.isConnected) return;
      if (this.pointerDownInside || this.inPickerTree(this.document.activeElement)) return;
      if (this.focusSession) {
        this.focusSession = false;
        this.blurred.set(true);
        this.commitTyped();
        this.touch.emit();
      }
      this.closePanel();
    });
  }

  /**
   * Writes the typed dates. Text that cannot be honored empties the value and stays on screen
   * with its error, as in `@ui/date-picker`, so a form never submits the range the user replaced.
   */
  private commitTyped(): void {
    if (!this.editing) return;
    this.editing = false;
    const locale = this.localeInfo().locale;
    const from = parseLocalizedDate(this.fromDraft(), locale);
    const to = parseLocalizedDate(this.toDraft(), locale);

    if (from.kind === 'empty' && to.kind === 'empty') {
      this.write({ ...EMPTY_DATE_RANGE });
      this.entryError.set(undefined);
      return;
    }
    if (from.kind !== 'valid' || to.kind !== 'valid') {
      this.reject('dateFormat');
      return;
    }
    const range = { from: from.date, to: to.date };
    const error = checkDateRange(range, this.constraints());
    if (error) {
      this.reject(error);
      return;
    }
    const current = this.value();
    // Retyping the same dates keeps the preset that produced them.
    const unchanged = current.from === range.from && current.to === range.to;
    this.write({ preset: unchanged ? current.preset : null, ...range });
    this.fromDraft.set(formatDate(range.from, locale));
    this.toDraft.set(formatDate(range.to, locale));
    this.entryError.set(undefined);
  }

  private reject(kind: DateRangeErrorKind): void {
    this.write({ ...EMPTY_DATE_RANGE });
    this.entryError.set(kind);
  }

  private write(value: DateRangeValue): void {
    this.written = value;
    this.value.set(value);
  }

  private openPanel(): void {
    if (this.disabled() || this.popoverRef()) return;
    const value = this.value();
    const complete = isCanonicalDate(value.from) && isCanonicalDate(value.to);
    this.draftFrom.set(complete ? value.from : '');
    this.draftTo.set(complete ? value.to : '');
    this.draftPreset.set(complete ? value.preset : null);
    this.anchor.set('');
    this.preview.set('');

    // The range's last month sits in the last column, so the past leads up to it.
    const end = complete ? value.to : this.resolvedToday();
    this.firstMonth.set(addMonths(end.slice(0, 7), 1 - this.monthCount()));
    const start = complete ? value.from : end;
    const focusTarget = this.isVisible(start) ? start : end;
    this.focusedDate.set(focusTarget);

    const ref = this.popover.open({
      anchor: this.frame().nativeElement,
      template: this.panelTemplate(),
      viewContainerRef: this.viewContainerRef,
      positions: PANEL_POSITIONS,
      panelClass: 'date-range-picker-pane',
      // Pointers on the control itself are not outside: the document listener decides.
      dismissOnOutsidePointer: false,
      // Escape leaves the month grid before it closes the panel: `onPanelKeydown`.
      dismissOnEscape: false,
      scrollBehavior: 'reposition',
      onClose: (reason) => {
        this.onPanelClosed(reason);
      },
    });
    this.popoverRef.set(ref);
    this.document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.focusDay(focusTarget);
  }

  private closePanel(restoreFocus = false): void {
    const ref = this.popoverRef();
    if (!ref) return;
    void ref.close();
    if (restoreFocus) this.toggle().nativeElement.focus();
  }

  private onPanelClosed(reason: PopoverCloseReason): void {
    this.document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.popoverRef.set(null);
    this.anchor.set('');
    this.preview.set('');
    this.view.set('days');
    this.stopDrag();
    this.suppressClickUntil = 0;
    if (reason === 'escape') this.toggle().nativeElement.focus();
  }

  private closeMonthView(): void {
    this.view.set('days');
    this.focusInPanel(`[data-heading-index="${String(this.viewColumn())}"]`);
  }

  private readonly onDragMove = (event: PointerEvent): void => {
    const date = this.dateAt(event);
    if (date === undefined) return;
    if (!this.dragging) {
      if (date === this.dragOrigin) return;
      this.dragging = true;
      this.draftPreset.set(null);
      this.draftFrom.set('');
      this.draftTo.set('');
      this.anchor.set(this.dragOrigin);
    }
    // Read after the anchor is set: the days past `maxDays` from it are disabled.
    const day = this.findDay(date);
    if (day && !day.disabled) this.preview.set(date);
  };

  private readonly onDragEnd = (): void => {
    const dragged = this.dragging;
    this.stopDrag();
    if (!dragged) return;
    this.suppressClickUntil = Date.now() + DRAG_CLICK_WINDOW;
    const anchor = this.anchor();
    const end = this.preview();
    // Every day the pointer crossed was out of reach: the first day waits, as after a click.
    if (end === '') return;
    const range = orderDates(anchor, end);
    this.draftFrom.set(range.from);
    this.draftTo.set(range.to);
    this.anchor.set('');
    this.preview.set('');
    this.focusedDate.set(end);
  };

  /** The browser took the pointer, for a scroll or a gesture. The first day waits, as after a click. */
  private readonly onDragCancel = (): void => {
    this.stopDrag();
  };

  private stopDrag(): void {
    this.document.removeEventListener('pointermove', this.onDragMove);
    this.document.removeEventListener('pointerup', this.onDragEnd);
    this.document.removeEventListener('pointercancel', this.onDragCancel);
    this.dragOrigin = '';
    this.dragging = false;
  }

  /**
   * The day under the pointer. The hit test, not the event target, because touch keeps
   * targeting the first day. jsdom has no layout, so it falls back to the target.
   */
  private dateAt(event: PointerEvent): DateValue | undefined {
    const element = this.hitTest(event) ?? event.target;
    const cell = element instanceof Element ? element.closest('[data-date]') : null;
    if (!cell || !this.popoverRef()?.overlayElement.contains(cell)) return undefined;
    return cell.getAttribute('data-date') ?? undefined;
  }

  private hitTest(event: PointerEvent): Element | null {
    try {
      return this.document.elementFromPoint(event.clientX, event.clientY);
    } catch {
      return null;
    }
  }

  private readonly onDocumentPointerDown = (event: PointerEvent): void => {
    if (this.inPickerTree(event.target)) {
      this.onPointerDownInside();
      return;
    }
    void this.popoverRef()?.close('outside');
  };

  private inPickerTree(node: unknown): boolean {
    if (!(node instanceof Node)) return false;
    return (
      this.elementRef.nativeElement.contains(node) ||
      !!this.popoverRef()?.overlayElement.contains(node)
    );
  }

  /** Moves the visible months by `amount` and keeps the roving day inside them. */
  private shiftMonths(amount: number): void {
    this.firstMonth.set(addMonths(this.firstMonth(), amount));
    const day = parseIsoDate(this.focusedDate())?.day ?? 1;
    this.focusedDate.set(dateInMonth(addMonths(this.focusedDate().slice(0, 7), amount), day));
    this.popoverRef()?.updatePosition();
  }

  /** Shows `month` with the least movement: it becomes the first or the last column. */
  private revealMonth(month: MonthValue): void {
    const first = this.firstMonth();
    const last = addMonths(first, this.monthCount() - 1);
    if (month < first) {
      this.firstMonth.set(month);
    } else if (month > last) {
      this.firstMonth.set(addMonths(month, 1 - this.monthCount()));
    }
  }

  private monthAllowed(month: MonthValue): boolean {
    const minMonth = dateToMonth(this.minDate() ?? '');
    const maxMonth = dateToMonth(this.maxDate() ?? '');
    return (!minMonth || month >= minMonth) && (!maxMonth || month <= maxMonth);
  }

  private isVisible(date: DateValue): boolean {
    const month = date.slice(0, 7);
    const first = this.firstMonth();
    return month >= first && month <= addMonths(first, this.monthCount() - 1);
  }

  private findDay(date: DateValue): RangeCalendarDay | undefined {
    for (const month of this.months()) {
      for (const week of month.weeks) {
        const day = week.find((candidate) => candidate.inCurrentMonth && candidate.date === date);
        if (day) return day;
      }
    }
    return undefined;
  }

  private focusDay(date: DateValue): void {
    this.focusInPanel(`[data-date="${date}"]`);
  }

  /** Focuses an element of the panel once the change that renders it has run. */
  private focusInPanel(selector: string): void {
    afterNextRender(
      () => {
        this.popoverRef()?.overlayElement.querySelector<HTMLElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }

  /** One month on a narrow screen. jsdom has no `matchMedia`, so it keeps two. */
  private watchWidth(view: (Window & typeof globalThis) | null): void {
    if (!view || !('matchMedia' in view)) return;
    const query = view.matchMedia(NARROW_QUERY);
    const update = (): void => {
      this.monthCount.set(query.matches ? 1 : 2);
    };
    update();
    query.addEventListener('change', update);
    this.injector.get(DestroyRef).onDestroy(() => {
      query.removeEventListener('change', update);
    });
  }
}
