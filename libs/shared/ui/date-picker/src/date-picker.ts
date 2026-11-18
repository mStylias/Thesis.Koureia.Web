import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { ConnectedPosition } from '@angular/cdk/overlay';
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
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
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { Grid, GridCell, GridRow } from '@angular/aria/grid';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import {
  LucideCalendarDays,
  LucideChevronLeft,
  LucideChevronRight,
  LucideX,
} from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import { PopoverCloseReason, PopoverRef, PopoverService } from '@ui/popover';
import {
  CalendarDay,
  DateConstraints,
  DatePickerMode,
  DatePickerSize,
  DateRange,
  DateValue,
  DayAvailability,
  IsoWeekday,
  MonthValue,
} from './date-picker.types';
import {
  addDays,
  addMonths,
  createDateLocaleInfo,
  createMonthGrid,
  dateInMonth,
  dateToMonth,
  formatDate,
  formatMonthHeading,
  isCanonicalDate,
  isDateAllowed,
  parseIsoDate,
  parseLocalizedDate,
  todayLocal,
} from './date-picker.utils';
import { DatePickerFooter } from './footer/date-picker-footer';
import { DatePickerLegend } from './legend/date-picker-legend';

// Above the frame, aligned to its leading edge; below it when there is no room.
const ERROR_POSITIONS: readonly ConnectedPosition[] = [
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
];

const DROPDOWN_POSITIONS: readonly ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

let nextUniqueId = 0;

/**
 * Locale-aware appointment-date control. `dropdown` anchors the calendar in a
 * popover; `inline` renders it in flow. Both keep the text field editable.
 * Values are canonical Gregorian `YYYY-MM-DD` strings, whatever regional
 * format is displayed, and bind directly to Signal Forms through
 * `FormValueControl<string>`.
 */
@Component({
  selector: 'lib-date-picker',
  imports: [
    Grid,
    GridCell,
    GridRow,
    LucideCalendarDays,
    LucideChevronLeft,
    LucideChevronRight,
    LucideX,
    DatePickerFooter,
    DatePickerLegend,
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [
    PopoverService,
    provideTranslocoScope({
      scope: 'datePicker',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.scss',
  host: {
    '[attr.data-mode]': 'mode()',
    '[attr.data-size]': 'size()',
    '[attr.data-input-hidden]': 'mode() === "inline" && !showInput() ? "" : null',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-invalid]': 'isInvalid() ? "" : null',
    '[attr.data-frameless]': 'frameless() ? "" : null',
    '[attr.data-compact]': 'compact() ? "" : null',
    '[attr.data-borderless]': 'borderless() ? "" : null',
    '[attr.data-filled]': 'value() ? "" : null',
    '(pointerdown)': 'onPointerDownInside()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'onFocusOut()',
  },
})
export class DatePicker implements FormValueControl<string>, OnDestroy {
  /** Canonical `YYYY-MM-DD`; empty string means no selection. */
  readonly value = model<DateValue>('');
  /** `dropdown` anchors the calendar in a popover; `inline` renders it in flow. */
  readonly mode = input<DatePickerMode>('dropdown');
  /** Field density. */
  readonly size = input<DatePickerSize>('md');
  /** Earliest selectable date, inclusive. */
  readonly min = input<DateValue | undefined>(undefined);
  /** Latest selectable date, inclusive. */
  readonly max = input<DateValue | undefined>(undefined);
  /** When set, only these exact dates are selectable. An empty list allows no date. */
  readonly validDates = input<readonly DateValue[] | null>(null);
  /** Exact unavailable dates. */
  readonly excludedDates = input<readonly DateValue[]>([]);
  /** Inclusive ranges of unavailable dates. */
  readonly excludedRanges = input<readonly DateRange[]>([]);
  /** Recurring days off as ISO weekdays (1 = Monday … 7 = Sunday). */
  readonly excludedWeekdays = input<readonly IsoWeekday[]>([]);
  /**
   * The free share of each day's capacity, `0` to `1`. A selectable day of the shown month
   * takes an accent tint by level: above 50% strong, 20% to 50% medium, below 20% faint. The
   * level is added to the day's accessible name, and a legend shows while any day has one.
   * A day without an entry, or at `0`, stays plain.
   */
  readonly availability = input<DayAvailability>({});
  /** Month to open on while there is no value. */
  readonly startAt = input<DateValue>('');
  /** Overrides "today" for tests and stories. */
  readonly today = input<DateValue>('');
  /** BCP 47 locale; defaults to the browser's first language after hydration. */
  readonly locale = input('');
  /** First calendar column; `auto` follows the locale. */
  readonly firstDayOfWeek = input<'auto' | IsoWeekday>('auto');
  /** Overrides the format hint derived from the locale. */
  readonly placeholder = input('');
  /** Whether inline mode renders its editable date input. Dropdown mode always renders it. */
  readonly showInput = input(true, { transform: booleanAttribute });
  /** Whether the calendar footer offers a "today" shortcut. */
  readonly showToday = input(true, { transform: booleanAttribute });
  /** Whether the footer offers a current-date-and-time action. */
  readonly showNow = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Read-only keeps the calendar readable but withholds every edit affordance. */
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * Hides the field's border, background and focus ring, for a picker composed
   * into a frame its parent draws — a date beside an operation chooser, a
   * bound beside its opposite. The parent then owns the resting border, the
   * `:focus-within` ring and the invalid border for the whole group.
   *
   * The error message still renders, floating over the frame in an overlay so
   * it never re-flows it and no scroll container can clip it. Put
   * `data-field-frame` on the frame and the message anchors to that edge.
   */
  readonly frameless = input(false, { transform: booleanAttribute });
  /** Reduces calendar spacing for use inside a composite panel. */
  readonly compact = input(false, { transform: booleanAttribute });
  /** Removes the calendar panel border when a parent surface owns it. */
  readonly borderless = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  /** Id for the text field; one is generated when omitted. */
  readonly inputId = input('');
  readonly name = input('');
  readonly ariaLabel = input('');
  readonly ariaLabelledby = input('');
  /** Consumer description ids; the control appends its own error id. */
  readonly ariaDescribedby = input('');
  /**
   * Whether a clear button appears once the field holds a date.
   *
   * Off by default: the field is editable text, so selecting it and deleting is already a way
   * out, and a second adornment costs width every field pays for and few need. A filter bar is
   * where it earns its place — clearing there is a frequent, deliberate act, and the field
   * beside it has a clear button of its own.
   */
  readonly showClear = input(false, { transform: booleanAttribute });
  /** Overrides the translated name of the clear button. */
  readonly clearAriaLabel = input('');

  /** Emits the `YYYY-MM` the calendar moved to. */
  readonly visibleMonthChange = output<MonthValue>();
  /** Emits the current local instant after selecting its date. */
  readonly nowSelected = output<Date>();
  /** Emits once focus leaves the whole control. */
  readonly touch = output();

  protected readonly fieldId = `lib-date-picker-field-${nextUniqueId}`;
  protected readonly panelId = `lib-date-picker-panel-${nextUniqueId}`;
  protected readonly headingId = `lib-date-picker-heading-${nextUniqueId}`;
  protected readonly errorId = `lib-date-picker-error-${nextUniqueId++}`;

  protected readonly draft = signal('');
  protected readonly visibleMonth = signal<MonthValue>(todayLocal().slice(0, 7));
  protected readonly focusedDate = signal<DateValue>(todayLocal());
  protected readonly blurred = signal(false);
  protected readonly entryErrorVisible = signal(false);
  private readonly defaultToday = signal(todayLocal());
  private readonly detectedLocale: ReturnType<typeof signal<string>>;
  private readonly popoverRef = signal<PopoverRef | null>(null);
  private readonly errorRef = signal<PopoverRef | null>(null);
  private readonly rendered = signal(false);
  private editing = false;
  private viewInitialized = false;
  private focusSession = false;
  private pointerDownInside = false;

  private readonly document = inject(DOCUMENT);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly angularLocale = inject(LOCALE_ID);
  private readonly transloco = inject(TranslocoService);
  private readonly popover = inject(PopoverService);

  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');
  private readonly field = viewChild.required<ElementRef<HTMLElement>>('field');
  private readonly overlayTemplate = viewChild.required<TemplateRef<unknown>>('overlayTemplate');
  private readonly errorTemplate = viewChild.required<TemplateRef<unknown>>('errorPanel');

  protected readonly isOpen = computed(() => this.popoverRef() !== null);
  protected readonly resolvedLocale = computed(() => this.locale().trim() || this.detectedLocale());
  protected readonly resolvedToday = computed(() =>
    isCanonicalDate(this.today()) ? this.today() : this.defaultToday(),
  );
  protected readonly localeInfo = computed(() =>
    createDateLocaleInfo(this.resolvedLocale(), this.firstDayOfWeek()),
  );
  protected readonly constraints = computed<DateConstraints>(() => ({
    min: this.min(),
    max: this.max(),
    validDates: this.validDates() ?? undefined,
    excludedDates: this.excludedDates(),
    excludedRanges: this.excludedRanges(),
    excludedWeekdays: this.excludedWeekdays(),
  }));
  protected readonly parsedEntry = computed(() =>
    parseLocalizedDate(this.draft(), this.localeInfo().locale),
  );
  protected readonly calendarRows = computed(() =>
    createMonthGrid(
      this.visibleMonth(),
      this.localeInfo(),
      this.constraints(),
      this.resolvedToday(),
      this.availability(),
    ),
  );
  protected readonly showLegend = computed(() =>
    this.calendarRows().some((week) => week.some((day) => day.availability !== null)),
  );
  protected readonly monthHeading = computed(() =>
    formatMonthHeading(this.visibleMonth(), this.localeInfo().locale),
  );
  protected readonly firstError = computed(() => this.errors().at(0));
  protected readonly entryErrorKind = computed<'dateFormat' | 'dateUnavailable' | undefined>(() => {
    const parsed = this.parsedEntry();
    if (parsed.kind === 'partial' || parsed.kind === 'invalid') {
      return 'dateFormat';
    }
    if (parsed.kind === 'valid' && !isDateAllowed(parsed.date, this.constraints())) {
      return 'dateUnavailable';
    }
    return undefined;
  });
  protected readonly isInvalid = computed(
    () => this.invalid() || (this.entryErrorVisible() && !!this.entryErrorKind()),
  );
  protected readonly showError = computed(
    () =>
      (this.entryErrorVisible() && !!this.entryErrorKind()) ||
      ((this.touched() || this.blurred()) && !!this.firstError()),
  );
  protected readonly errorKey = computed(() => {
    const kind = this.entryErrorKind() ?? this.firstError()?.kind;
    return kind === 'required' || kind === 'dateFormat' || kind === 'dateUnavailable'
      ? `datePicker.errors.${kind}`
      : 'datePicker.errors.dateUnavailable';
  });
  protected readonly describedBy = computed(
    () =>
      [this.ariaDescribedby(), this.showError() ? this.errorId : ''].filter(Boolean).join(' ') ||
      undefined,
  );
  protected readonly canGoPrevious = computed(() => {
    const minMonth = this.min() ? dateToMonth(this.min() ?? '') : undefined;
    return !minMonth || addMonths(this.visibleMonth(), -1) >= minMonth;
  });
  protected readonly canGoNext = computed(() => {
    const maxMonth = this.max() ? dateToMonth(this.max() ?? '') : undefined;
    return !maxMonth || addMonths(this.visibleMonth(), 1) <= maxMonth;
  });
  protected readonly todayAllowed = computed(() =>
    isDateAllowed(this.resolvedToday(), this.constraints()),
  );
  protected readonly panelPosition = computed(() =>
    this.popoverRef()?.position()?.overlayY === 'bottom' ? 'top' : 'bottom',
  );

  constructor() {
    claimFieldError();
    const initialLocale = this.transloco.getActiveLang() || this.angularLocale || 'el-GR';
    this.detectedLocale = signal(initialLocale);

    afterNextRender(() => {
      const browserLocale = this.document.defaultView?.navigator.languages[0];
      if (browserLocale) {
        this.detectedLocale.set(browserLocale);
      }
      this.defaultToday.set(todayLocal());
      // Gates the error overlay: it needs the view, and an overlay must not be
      // built on the server.
      this.rendered.set(true);
    });

    effect(() => {
      if (this.frameless() && this.showError() && this.rendered()) {
        this.openError();
      } else {
        this.errorRef()?.dispose();
        this.errorRef.set(null);
      }
    });

    effect(() => {
      const formatted = formatDate(this.value(), this.localeInfo().locale);
      if (!this.editing) {
        this.draft.set(formatted);
      }
    });

    effect(() => {
      const selectedMonth = dateToMonth(this.value());
      if (selectedMonth) {
        this.visibleMonth.set(selectedMonth);
        this.focusedDate.set(this.value());
        this.viewInitialized = true;
        return;
      }
      if (!this.viewInitialized) {
        const seed =
          dateToMonth(this.startAt()) ??
          dateToMonth(this.resolvedToday()) ??
          todayLocal().slice(0, 7);
        this.visibleMonth.set(seed);
        this.focusedDate.set(
          isCanonicalDate(this.startAt()) ? this.startAt() : this.resolvedToday(),
        );
        this.viewInitialized = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.popoverRef()?.dispose();
    this.errorRef()?.dispose();
  }

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.editing = true;
    this.draft.set(raw);
    this.entryErrorVisible.set(false);

    const parsed = parseLocalizedDate(raw, this.localeInfo().locale);
    if (parsed.kind === 'valid') {
      this.focusedDate.set(parsed.date);
      this.setVisibleMonth(dateToMonth(parsed.date));
      this.value.set(isDateAllowed(parsed.date, this.constraints()) ? parsed.date : '');
    } else {
      this.value.set('');
    }
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openDropdown(true);
    } else if (event.key === 'Enter') {
      this.commitDraft();
      if (!this.entryErrorKind()) {
        this.closeDropdown();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDropdown(true);
    }
  }

  protected toggleDropdown(): void {
    if (this.isOpen()) {
      this.closeDropdown();
    } else {
      this.openDropdown(true);
    }
  }

  protected previousMonth(): void {
    if (this.canGoPrevious() && !this.disabled()) {
      this.navigateMonth(-1);
    }
  }

  protected nextMonth(): void {
    if (this.canGoNext() && !this.disabled()) {
      this.navigateMonth(1);
    }
  }

  protected selectToday(): void {
    const today = this.resolvedToday();
    if (this.disabled() || this.readonly() || !isDateAllowed(today, this.constraints())) {
      return;
    }
    this.selectDate(today);
  }

  protected selectNow(): void {
    const now = new Date();
    const date = todayLocal();
    if (this.disabled() || this.readonly() || !isDateAllowed(date, this.constraints())) return;
    this.selectDate(date);
    this.nowSelected.emit(now);
  }

  protected onDaySelection(day: CalendarDay, selected: boolean): void {
    if (
      selected &&
      day.date !== this.value() &&
      !day.disabled &&
      !this.disabled() &&
      !this.readonly()
    ) {
      this.selectDate(day.date);
    }
  }

  protected onDayClick(day: CalendarDay): void {
    if (!day.disabled && !this.disabled() && !this.readonly()) {
      this.selectDate(day.date);
    }
  }

  protected onDayFocus(date: DateValue): void {
    this.focusedDate.set(date);
  }

  protected onCalendarKeydown(event: KeyboardEvent): void {
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const direction = event.key === 'PageUp' ? -1 : 1;
      this.navigateMonth(direction * (event.shiftKey ? 12 : 1));
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      const week = this.calendarRows().find((row) =>
        row.some((day) => day.date === this.focusedDate()),
      );
      const target = event.key === 'Home' ? week?.[0]?.date : week?.[6]?.date;
      const targetMonth = target ? dateToMonth(target) : undefined;
      if (target && targetMonth && targetMonth !== this.visibleMonth()) {
        event.preventDefault();
        this.focusedDate.set(target);
        this.setVisibleMonth(targetMonth);
        this.focusCalendarDate(target);
      }
      return;
    }

    const offsets: Partial<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const offset = offsets[event.key];
    if (offset === undefined) {
      return;
    }
    const target = addDays(this.focusedDate(), offset);
    const targetMonth = dateToMonth(target);
    if (targetMonth && targetMonth !== this.visibleMonth()) {
      event.preventDefault();
      this.focusedDate.set(target);
      this.setVisibleMonth(targetMonth);
      this.focusCalendarDate(target);
    }
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

  protected onFocusOut(): void {
    queueMicrotask(() => {
      if (this.pointerDownInside || this.inPickerTree(this.document.activeElement)) {
        return;
      }
      if (this.focusSession) {
        this.focusSession = false;
        this.blurred.set(true);
        this.commitDraft();
        this.touch.emit();
      }
      this.closeDropdown();
    });
  }

  /** Focuses the text field, or the focused day when only the calendar renders. */
  focus(options?: FocusOptions): void {
    if (this.mode() === 'inline' && !this.showInput()) {
      const date = this.initialFocusDate();
      this.focusedDate.set(date);
      this.elementRef.nativeElement
        .querySelector<HTMLElement>(`[data-date="${date}"]`)
        ?.focus(options);
      return;
    }
    this.dateInput().nativeElement.focus(options);
  }

  /**
   * Empties the value and the text, and returns focus to the field.
   *
   * Guarded like every other affordance: a click that lands after the control turned disabled
   * or read-only must not edit it.
   */
  protected clear(): void {
    if (this.disabled() || this.readonly()) {
      return;
    }
    this.editing = false;
    this.value.set('');
    this.draft.set('');
    this.entryErrorVisible.set(false);
    this.dateInput().nativeElement.focus();
  }

  /** Drops any uncommitted text and error state, restoring the value's format. */
  reset(): void {
    this.editing = false;
    this.blurred.set(false);
    this.entryErrorVisible.set(false);
    this.draft.set(formatDate(this.value(), this.localeInfo().locale));
  }

  private commitDraft(): void {
    this.editing = false;
    const parsed = this.parsedEntry();
    if (parsed.kind === 'empty') {
      this.value.set('');
      this.entryErrorVisible.set(false);
      return;
    }
    if (parsed.kind !== 'valid' || !isDateAllowed(parsed.date, this.constraints())) {
      this.value.set('');
      this.entryErrorVisible.set(true);
      return;
    }
    this.value.set(parsed.date);
    this.draft.set(formatDate(parsed.date, this.localeInfo().locale));
    this.entryErrorVisible.set(false);
  }

  private selectDate(date: DateValue): void {
    this.editing = false;
    this.value.set(date);
    this.draft.set(formatDate(date, this.localeInfo().locale));
    this.focusedDate.set(date);
    this.setVisibleMonth(dateToMonth(date));
    this.entryErrorVisible.set(false);
    if (this.mode() === 'dropdown') {
      this.closeDropdown();
      this.dateInput().nativeElement.focus();
    }
  }

  private navigateMonth(amount: number): void {
    const next = addMonths(this.visibleMonth(), amount);
    const minMonth = this.min() ? dateToMonth(this.min() ?? '') : undefined;
    const maxMonth = this.max() ? dateToMonth(this.max() ?? '') : undefined;
    const bounded =
      minMonth && next < minMonth ? minMonth : maxMonth && next > maxMonth ? maxMonth : next;
    const preferredDay = parseIsoDate(this.focusedDate())?.day ?? 1;
    const target = dateInMonth(bounded, preferredDay);
    this.focusedDate.set(target);
    this.setVisibleMonth(bounded);
    this.focusCalendarDate(target);
  }

  private setVisibleMonth(month: MonthValue | undefined): void {
    if (!month || month === this.visibleMonth()) {
      return;
    }
    this.visibleMonth.set(month);
    this.visibleMonthChange.emit(month);
    this.popoverRef()?.updatePosition();
  }

  /**
   * The message rides in an overlay, not in the control's own box, because a
   * composed picker sits inside whatever its host scrolls: a data grid's
   * viewport clips everything drawn outside it, so an absolutely positioned
   * message loses its top the moment it is taller than the row above it. No
   * z-index reaches out of a clip.
   *
   * It anchors to the frame rather than to the field, so it starts at the
   * frame's leading edge instead of after whatever the frame holds before the
   * picker. The frame declares itself with `data-field-frame`.
   */
  private openError(): void {
    if (this.errorRef()) {
      return;
    }
    const host = this.elementRef.nativeElement;
    const ref = this.popover.open({
      anchor: host.closest<HTMLElement>('[data-field-frame]') ?? this.field().nativeElement,
      template: this.errorTemplate(),
      viewContainerRef: this.viewContainerRef,
      positions: ERROR_POSITIONS,
      panelClass: 'date-error-pane',
      // It reports state and takes no input: nothing the user does dismisses
      // it, and Escape belongs to the calendar.
      dismissOnOutsidePointer: false,
      dismissOnEscape: false,
      scrollBehavior: 'reposition',
      onClose: () => {
        this.errorRef.set(null);
      },
    });
    // The pane is the consumer's to style, and CDK gives it `pointer-events:
    // auto`. Left alone it swallows every click on the header or toolbar it
    // covers, for a message that takes no input.
    ref.overlayElement.style.pointerEvents = 'none';
    this.errorRef.set(ref);
  }

  private openDropdown(focusCalendar: boolean): void {
    if (this.mode() !== 'dropdown' || this.disabled()) {
      return;
    }
    if (!this.popoverRef()) {
      const ref = this.popover.open({
        anchor: this.field().nativeElement,
        template: this.overlayTemplate(),
        viewContainerRef: this.viewContainerRef,
        positions: DROPDOWN_POSITIONS,
        dismissOnOutsidePointer: false,
        scrollBehavior: 'reposition',
        onClose: (reason) => {
          this.onPopoverClosed(reason);
        },
      });
      this.popoverRef.set(ref);
      this.document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    }
    if (focusCalendar) {
      const date = this.initialFocusDate();
      this.focusedDate.set(date);
      this.focusCalendarDate(date);
    }
  }

  private closeDropdown(restoreFocus = false): void {
    const ref = this.popoverRef();
    if (!ref) {
      return;
    }
    void ref.close();
    if (restoreFocus) {
      this.dateInput().nativeElement.focus();
    }
  }

  private onPopoverClosed(reason: PopoverCloseReason): void {
    this.document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.popoverRef.set(null);
    if (reason === 'escape') {
      this.dateInput().nativeElement.focus();
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
    if (!node || typeof (node as Node).nodeType !== 'number') {
      return false;
    }
    const domNode = node as Node;
    return (
      this.elementRef.nativeElement.contains(domNode) ||
      !!this.popoverRef()?.overlayElement.contains(domNode)
    );
  }

  private initialFocusDate(): DateValue {
    const selected = this.value();
    if (selected && isDateAllowed(selected, this.constraints())) {
      return selected;
    }
    const today = this.resolvedToday();
    if (dateToMonth(today) === this.visibleMonth() && isDateAllowed(today, this.constraints())) {
      return today;
    }
    return (
      this.calendarRows()
        .flat()
        .find((day) => !day.disabled)?.date ?? `${this.visibleMonth()}-01`
    );
  }

  private focusCalendarDate(date: DateValue, options?: FocusOptions): void {
    afterNextRender(
      () => {
        const root = this.popoverRef()?.overlayElement ?? this.elementRef.nativeElement;
        root.querySelector<HTMLElement>(`[data-date="${date}"]`)?.focus(options);
      },
      { injector: this.injector },
    );
  }
}
