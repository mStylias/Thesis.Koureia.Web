import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
  type TemplateRef,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import {
  LucideCalendarCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideEllipsis,
  LucideListFilter,
  LucidePlus,
  LucideRefreshCw,
  LucideCog,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { DatePicker, isCanonicalDate, type DateValue, type IsoWeekday } from '@ui/date-picker';
import { PopoverTrigger } from '@ui/popover';
import { Select, type SelectOption } from '@ui/select';
import { Spin } from '@ui/spin';
import { Tooltip } from '@ui/tooltip';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import { injectCalendarCopy } from '../core/calendar-copy';
import type { CalendarPanel, CalendarView } from '../calendar.types';
import { CALENDAR_VIEWS, isCalendarView } from '../core/toolbar-layout';
import type { CalendarToolbarLayout } from '../core/toolbar-layout.types';
import type { CalendarNavigation, CalendarPanelKind } from './calendar-toolbar.types';

/**
 * The calendar's toolbar: where the calendar is, how to move, what it shows.
 *
 * ```html
 * <lib-calendar-toolbar
 *   [layout]="layout()"
 *   [label]="rangeLabel()"
 *   [anchor]="anchor()"
 *   [(view)]="view"
 *   [(panel)]="panel"
 *   (navigate)="move($event)"
 *   (dateSelect)="jump($event)"
 * />
 * ```
 *
 * `layout` decides what is drawn inline. Everything else is in the overflow
 * panel behind one "more" button, drawn from the same templates, so a control
 * behaves the same in both places. The overflow is a panel and not a menu:
 * the view select and the saved views stay real controls there, and
 * `role="menu"` admits menu items only.
 */
@Component({
  selector: 'lib-calendar-toolbar',
  templateUrl: './calendar-toolbar.html',
  styleUrl: './calendar-toolbar.scss',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Button,
    DatePicker,
    PopoverTrigger,
    Select,
    Spin,
    Tooltip,
    LucideCalendarCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideEllipsis,
    LucideListFilter,
    LucidePlus,
    LucideRefreshCw,
    LucideCog,
  ],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
  host: {
    class: 'ct-host',
    '[attr.data-compact-range]': 'layout().compactRange ? "" : null',
  },
})
export class CalendarToolbar {
  /** Which controls are inline. From `toolbarLayout` over the calendar's width. */
  readonly layout = input.required<CalendarToolbarLayout>();

  /** The words that say where the calendar is, from `rangeLabel`. */
  readonly label = input('');

  /** The date the calendar is on. The date picker shows it. */
  readonly anchor = input.required<DateValue>();

  /** The view on show. The tabs and the select write it back. */
  readonly view = model<CalendarView>('week');

  /** The side panel on show. Filters and settings toggle it. */
  readonly panel = model<CalendarPanel>(null);

  readonly locale = input('el');

  readonly firstDayOfWeek = input<IsoWeekday>(1);

  /** Draws the Filters button. Off when the host has no filters to show. */
  readonly showFilters = input(true);

  /** How many filters the host has set. Shown as a count on the Filters button. */
  readonly filtersActive = input(0);

  /** Spins the refresh icon and blocks a second refresh. */
  readonly refreshing = input(false);

  /** Text of the create button. Falls back to a generic label. */
  readonly createLabel = input('');

  /** The host's saved views, drawn between the two separators or in the overflow panel. */
  readonly viewsTemplate = input<TemplateRef<unknown> | null>(null);

  /** Today, the previous step or the next step was asked for. */
  readonly navigate = output<CalendarNavigation>();

  /** A date was picked in the date picker. */
  readonly dateSelect = output<DateValue>();

  readonly refresh = output();

  /** The create button was pressed. */
  readonly create = output();

  /**
   * The width the views slot has, in CSS pixels. The slot takes what the other
   * controls leave and never sizes to its content, so the views can read it
   * without feeding back on it. Infinite until measured.
   */
  readonly viewsWidth = signal(Number.POSITIVE_INFINITY);

  private readonly viewsSlotRef = viewChild<ElementRef<HTMLElement>>('viewsSlot');
  private readonly segmentRef = viewChild<ElementRef<HTMLElement>>('segment');
  private readonly segmentPillRef = viewChild<ElementRef<HTMLElement>>('segmentPill');
  private readonly segmentItemRefs = viewChildren<ElementRef<HTMLElement>>('segmentItem');

  /** What the pill was last given, so an unchanged measure writes nothing. */
  private pillPlacement = '';

  /** The view the pill was last placed for. `null` until the first placement. */
  private pillView: CalendarView | null = null;

  /** Bumped when the segment resizes, as when a font or a language arrives. */
  private readonly segmentTick = signal(0);

  constructor() {
    // The pressed view's highlight glides between the buttons. Written to the
    // element rather than bound: a style binding fed by a measure would be a
    // signal write per resize.
    afterRenderEffect(() => {
      this.segmentTick();
      const view = this.view();
      const pill = this.segmentPillRef()?.nativeElement;
      const segment = this.segmentRef()?.nativeElement;
      const index = CALENDAR_VIEWS.indexOf(view);
      const item = this.segmentItemRefs().at(index)?.nativeElement;
      if (pill === undefined || segment === undefined || item === undefined) {
        this.pillPlacement = '';
        return;
      }
      untracked(() => {
        this.placePill(pill, segment, item, view);
      });
    });

    effect((onCleanup) => {
      const segment = this.segmentRef()?.nativeElement;
      if (segment === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => {
        this.segmentTick.update((tick) => tick + 1);
      });
      observer.observe(segment);
      onCleanup(() => {
        observer.disconnect();
      });
    });

    effect((onCleanup) => {
      const slot = this.viewsSlotRef()?.nativeElement;
      if (slot === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver((entries) => {
        const box = entries.at(-1)?.contentRect;
        const width = box === undefined ? 0 : Math.round(box.width);
        if (width > 0 && width !== this.viewsWidth()) {
          this.viewsWidth.set(width);
        }
      });
      observer.observe(slot);
      onCleanup(() => {
        observer.disconnect();
      });
    });
  }

  private readonly copy = injectCalendarCopy();

  protected readonly viewOptions = computed<readonly SelectOption<CalendarView>[]>(() =>
    CALENDAR_VIEWS.map((view) => ({ value: view, label: this.copy(`calendar.views.${view}`) })),
  );

  /** The views strip is drawn inline. */
  protected readonly viewsInline = computed(
    () => this.viewsTemplate() !== null && this.layout().views !== 'menu',
  );

  /** The views strip is in the overflow panel. */
  protected readonly viewsFolded = computed(
    () => this.viewsTemplate() !== null && this.layout().views === 'menu',
  );

  protected readonly filtersFolded = computed(
    () => this.showFilters() && !this.layout().filtersInline,
  );

  /**
   * A press on a view button moves the pill in the same task. Left to the
   * render after it, the glide started two frames late, measured at 144Hz.
   */
  protected onSegmentPick(value: CalendarView, event: Event): void {
    const pill = this.segmentPillRef()?.nativeElement;
    const segment = this.segmentRef()?.nativeElement;
    if (pill !== undefined && segment !== undefined && event.currentTarget instanceof HTMLElement) {
      this.placePill(pill, segment, event.currentTarget, value);
    }
    this.onViewPick(value);
  }

  protected onViewPick(value: unknown): void {
    if (isCalendarView(value)) {
      this.view.set(value);
    }
  }

  /**
   * Writes only a change, so a resize that measures the same writes nothing.
   * Only a change of view glides. A re-measure for the same view, as when a font
   * arrives or the bar folds, jumps into place: on load it would slide.
   */
  private placePill(
    pill: HTMLElement,
    segment: HTMLElement,
    item: HTMLElement,
    view: CalendarView,
  ): void {
    const placement = `${item.offsetLeft.toString()}:${item.offsetWidth.toString()}`;
    if (placement === this.pillPlacement || item.offsetWidth === 0) {
      return;
    }
    const glide = view !== this.pillView;
    this.pillPlacement = placement;
    this.pillView = view;
    if (!glide) {
      pill.style.transition = 'none';
    }
    pill.style.transform = `translateX(${item.offsetLeft.toString()}px)`;
    pill.style.width = `${item.offsetWidth.toString()}px`;
    if (!glide) {
      // Commit the jump before the transition comes back, or it glides anyway.
      void pill.offsetWidth;
      pill.style.transition = '';
    }
    // The first placement lands where it is. Only a change of view glides.
    if (!segment.hasAttribute('data-ready')) {
      requestAnimationFrame(() => {
        segment.setAttribute('data-ready', '');
      });
    }
  }

  protected onDatePick(value: DateValue): void {
    if (isCanonicalDate(value) && value !== this.anchor()) {
      this.dateSelect.emit(value);
    }
  }

  /** The button of the panel on show closes it; the other swaps the content in place. */
  protected togglePanel(kind: CalendarPanelKind, overflow: PopoverTrigger | null): void {
    this.panel.update((current) => (current === kind ? null : kind));
    overflow?.hide();
  }

  protected onRefresh(overflow: PopoverTrigger | null): void {
    if (this.refreshing()) {
      return;
    }
    this.refresh.emit();
    overflow?.hide();
  }

  protected onCreate(overflow: PopoverTrigger | null): void {
    this.create.emit();
    overflow?.hide();
  }
}
