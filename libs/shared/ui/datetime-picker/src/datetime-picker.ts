import { ConnectedPosition } from '@angular/cdk/overlay';
import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
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
import { type ValidationError, FormValueControl } from '@angular/forms/signals';
import { LucideCalendarClock, LucideX } from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { DatePicker, formatDate, parseLocalizedDate } from '@ui/date-picker';
import { Button } from '@ui/button';
import { PopoverRef, PopoverService } from '@ui/popover';
import { normalizeTime, TimePicker } from '@ui/time-picker';
import { Switch } from '@ui/switch';

const POSITIONS: readonly ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
];

let nextUniqueId = 0;

/**
 * Local date-and-time control. The calendar is always required for a value;
 * time is optional and changes the returned `Date` from local midnight to the
 * selected wall-clock instant.
 */
@Component({
  selector: 'lib-datetime-picker',
  imports: [
    Button,
    DatePicker,
    LucideCalendarClock,
    LucideX,
    Switch,
    TimePicker,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [
    PopoverService,
    provideTranslocoScope({
      scope: 'datetimePicker',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  templateUrl: './datetime-picker.html',
  styleUrl: './datetime-picker.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.data-filled]': 'value() ? "" : null',
    '[attr.data-icon-position]': 'iconPosition()',
    '[attr.data-frameless]': 'frameless() ? "" : null',
    '(focusout)': 'onFocusout($event)',
  },
})
export class DatetimePicker implements FormValueControl<Date | null>, OnDestroy {
  /** Local JavaScript date, or `null` when empty. */
  readonly value = model<Date | null>(null);
  /** Whether the selected date includes a wall-clock time. */
  readonly timeEnabled = model(false);
  /** Minutes between offered times. */
  readonly interval = input(30);
  /** Places the calendar affordance before or after the text. */
  readonly iconPosition = input<'start' | 'end'>('start');
  /** BCP 47 locale used to display and parse the date portion. */
  readonly locale = input('');
  /** Field prompt. An explicit empty string removes the translated default. */
  readonly placeholder = input<string | undefined>(undefined);
  /** Field density. */
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  /** Removes the field frame when a parent control draws it. */
  readonly frameless = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly inputId = input('');
  readonly name = input('');
  readonly ariaLabel = input('');
  readonly ariaLabelledby = input('');
  readonly ariaDescribedby = input('');
  /** Emits once focus leaves the whole control and its panel. */
  readonly touch = output();

  protected readonly panelId = `lib-datetime-picker-panel-${nextUniqueId}`;
  protected readonly fieldId = `lib-datetime-picker-field-${nextUniqueId++}`;
  protected readonly draft = signal('');
  protected readonly selectedTime = signal('00:00');
  protected readonly panelValue = signal<Date | null>(null);
  protected readonly panelTimeEnabled = signal(false);
  protected readonly panelTime = signal('00:00');
  protected readonly panelModeChanged = signal(false);
  private popoverRef: PopoverRef | null = null;
  private editing = false;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly popover = inject(PopoverService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly angularLocale = inject(LOCALE_ID);
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly resolvedLocale = computed(() => this.locale().trim() || this.angularLocale);

  protected readonly dateValue = computed(() => {
    const value = this.value();
    if (value == null || Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear().toString().padStart(4, '0')}-${(value.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${value.getDate().toString().padStart(2, '0')}`;
  });
  protected readonly panelDateValue = computed(() => this.toDateValue(this.panelValue()));
  protected readonly displayValue = computed(() => {
    const value = this.value();
    if (value == null || Number.isNaN(value.getTime())) return '';
    const date = formatDate(this.dateValue(), this.resolvedLocale());
    return this.timeEnabled() ? `${date}, ${this.selectedTime()}` : date;
  });

  constructor() {
    effect(() => {
      const value = this.value();
      if (value != null && !Number.isNaN(value.getTime()) && this.timeEnabled()) {
        this.selectedTime.set(
          `${value.getHours().toString().padStart(2, '0')}:${value
            .getMinutes()
            .toString()
            .padStart(2, '0')}`,
        );
      }
      const display = this.displayValue();
      if (!this.editing) this.draft.set(display);
    });
  }

  ngOnDestroy(): void {
    this.popoverRef?.dispose();
  }

  protected togglePanel(): void {
    if (this.disabled()) return;
    if (this.popoverRef) {
      void this.popoverRef.close();
      return;
    }
    const value = this.value();
    this.panelValue.set(value == null ? null : new Date(value));
    this.panelTimeEnabled.set(this.timeEnabled());
    this.panelTime.set(this.selectedTime());
    this.panelModeChanged.set(false);
    this.popoverRef = this.popover.open({
      anchor: this.field().nativeElement,
      template: this.panel(),
      viewContainerRef: this.viewContainerRef,
      positions: POSITIONS,
      panelClass: 'datetime-picker-pane',
      onClose: () => (this.popoverRef = null),
    });
  }

  protected onInput(event: Event): void {
    this.editing = true;
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.commitDraft();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.togglePanel();
    } else if (event.key === 'Escape' && this.popoverRef) {
      event.preventDefault();
      void this.popoverRef.close('escape');
    }
  }

  protected commitDraft(): void {
    if (!this.editable() || !this.editing) return;
    const raw = this.draft().trim();
    this.editing = false;
    if (!raw) {
      this.clear();
      return;
    }
    const parts = raw.split(',').map((part) => part.trim());
    if (parts.length > 2) return;
    const parsedDate = parseLocalizedDate(parts[0], this.resolvedLocale());
    let parsedTime: string | undefined;
    if (parts.length === 2) {
      parsedTime = normalizeTime(parts[1]);
      if (!parsedTime) return;
    }
    if (parsedDate.kind !== 'valid') {
      return;
    }
    const [year, month, day] = parsedDate.date.split('-').map(Number);
    if (parsedTime) {
      const [hour, minute] = parsedTime.split(':').map(Number);
      this.selectedTime.set(parsedTime);
      this.timeEnabled.set(true);
      this.value.set(new Date(year, month - 1, day, hour, minute, 0, 0));
    } else {
      this.timeEnabled.set(false);
      this.value.set(new Date(year, month - 1, day));
    }
    this.draft.set(this.displayValue());
  }

  protected setDate(date: string): void {
    if (!this.editable() || !date) return;
    const [year, month, day] = date.split('-').map(Number);
    const [hourText, minuteText] = this.panelTime().split(':');
    const hour = this.panelTimeEnabled() ? Number(hourText) : 0;
    const minute = this.panelTimeEnabled() ? Number(minuteText) : 0;
    this.panelValue.set(new Date(year, month - 1, day, hour, minute, 0, 0));
  }

  protected setTime(time: string): void {
    if (!this.editable() || !this.panelTimeEnabled() || !time) return;
    this.panelTime.set(time);
    const current = this.panelValue();
    if (current == null) return;
    const [hour, minute] = time.split(':').map(Number);
    this.panelValue.set(
      new Date(current.getFullYear(), current.getMonth(), current.getDate(), hour, minute, 0, 0),
    );
  }

  protected selectNow(now: Date): void {
    if (!this.editable()) return;
    const time = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    this.panelModeChanged.set(true);
    this.panelTimeEnabled.set(true);
    this.panelTime.set(time);
    this.panelValue.set(
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()),
    );
  }

  protected selectMidnight(): void {
    if (!this.editable() || !this.panelTimeEnabled()) return;
    this.panelTime.set('00:00');
    const current = this.panelValue();
    if (current != null) {
      this.panelValue.set(new Date(current.getFullYear(), current.getMonth(), current.getDate()));
    }
  }

  protected setPanelTimeEnabled(enabled: boolean): void {
    if (!this.editable()) return;
    this.panelModeChanged.set(true);
    this.panelTimeEnabled.set(enabled);
    const current = this.panelValue();
    if (current != null && !enabled) {
      this.panelValue.set(new Date(current.getFullYear(), current.getMonth(), current.getDate()));
    }
  }

  protected cancelPanel(): void {
    void this.popoverRef?.close();
  }

  protected applyPanel(): void {
    if (!this.editable()) return;
    const value = this.panelValue();
    this.selectedTime.set(this.panelTime());
    this.timeEnabled.set(this.panelTimeEnabled());
    this.value.set(value == null ? null : new Date(value));
    void this.popoverRef?.close();
  }

  protected clear(): void {
    if (!this.editable()) return;
    this.value.set(null);
    this.timeEnabled.set(false);
    this.draft.set('');
  }

  protected onFocusout(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.host.nativeElement.contains(next) || this.popoverRef?.overlayElement.contains(next)) {
      return;
    }
    this.touch.emit();
  }

  /** Focuses the editable field. */
  focus(options?: FocusOptions): void {
    this.field().nativeElement.focus(options);
  }

  private editable(): boolean {
    return !this.disabled() && !this.readonly();
  }

  private toDateValue(value: Date | null): string {
    if (value == null || Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear().toString().padStart(4, '0')}-${(value.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${value.getDate().toString().padStart(2, '0')}`;
  }
}
