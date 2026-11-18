import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  contentChildren,
  effect,
  input,
  model,
  numberAttribute,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronsLeft,
  LucideChevronsRight,
} from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { Button } from '@ui/button';
import { InputNumber } from '@ui/input-number';
import { Select, SelectOption } from '@ui/select';
import { PaginatorTemplate, PaginatorSlot, PaginatorSlotContext } from './paginator-template';
import { buildPageItems, PaginatorSection, PaginatorState } from './paginator.types';

/** Default arrangement: boundary/step buttons around the numbered links. */
const DEFAULT_LAYOUT: readonly PaginatorSection[] = ['first', 'prev', 'pages', 'next', 'last'];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * A page size must be a positive whole number: zero divides by zero in the index math and
 * a negative walks the slice backwards. `null` for anything unusable.
 */
const normalizeRows = (rows: number): number | null =>
  Number.isFinite(rows) && rows >= 1 ? Math.floor(rows) : null;

/**
 * A record count must be a non-negative whole number. `numberAttribute` yields `NaN` for
 * anything unparseable, and `NaN` poisons everything downstream — `Math.max(1, NaN)` stays
 * `NaN` and the numbered strip renders empty. A negative total walks `last` behind `first`.
 */
const normalizeCount = (count: number): number =>
  Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;

/**
 * The page-link window must be a positive whole number. `NaN` reaching `buildPageItems`
 * makes every comparison false, so the strip renders nothing at all.
 */
const normalizeWindow = (size: number): number =>
  Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;

/**
 * Design-system paginator. `layout` lists which controls appear and in what order, so one
 * component covers a bare prev/next bar, a full numbered strip, or a data-grid footer with
 * a rows-per-page dropdown and a jump-to-page field.
 *
 * ```ts
 * import { Paginator } from '@ui/paginator';
 * ```
 *
 * ```html
 * <lib-paginator
 *   [(page)]="page"
 *   [(rows)]="rows"
 *   [totalRecords]="total()"
 *   [rowsPerPageOptions]="[10, 20, 50]"
 *   [layout]="['first', 'prev', 'pages', 'next', 'last', 'rowsPerPage', 'currentReport']"
 *   (paginate)="load($event)" />
 * ```
 *
 * Two-way `[(page)]` (1-based) and `[(rows)]`; `(paginate)` fires on every user-driven
 * change with the full {@link PaginatorState} for slicing: `rows.slice(first, last)`.
 *
 * Renders a `navigation` landmark with translated labels throughout and `aria-current` on
 * the active page. Sections can be overridden with `libPaginatorTemplate` slots.
 */
@Component({
  selector: 'lib-paginator',
  templateUrl: './paginator.html',
  styleUrl: './paginator.scss',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Button,
    Select,
    InputNumber,
    LucideChevronLeft,
    LucideChevronRight,
    LucideChevronsLeft,
    LucideChevronsRight,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'paginator',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    class: 'paginator',
    '[attr.data-disabled]': 'disabled() ? "" : null',
  },
})
export class Paginator {
  /** Current page, 1-based. Two-way. */
  readonly page = model(1);

  /** Rows shown per page. Two-way. */
  readonly rows = model(10);

  /** Total number of records across all pages. */
  readonly totalRecords = input(0, { transform: numberAttribute });

  /**
   * Page-size choices for the `rowsPerPage` dropdown. When empty, the
   * dropdown renders nothing even if `rowsPerPage` is in the layout.
   */
  readonly rowsPerPageOptions = input<readonly number[]>([]);

  /** Target width of the centred window in the numbered `pages` strip. */
  readonly pageLinkSize = input(5, { transform: numberAttribute });

  /** Ordered list of sections to render. */
  readonly layout = input<readonly PaginatorSection[]>(DEFAULT_LAYOUT);

  /**
   * Template for the `currentReport` section. Placeholders: `{currentPage}`,
   * `{totalPages}`, `{first}`, `{last}` (both 1-based), `{rows}`, `{totalRecords}`.
   * Empty falls back to the translated `paginator.currentReportTemplate`.
   */
  readonly currentPageReportTemplate = input('');

  /** When `false`, the whole paginator is hidden if there is one page or fewer. */
  readonly alwaysShow = input(true, { transform: booleanAttribute });

  /** Disables every control. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Accessible name for the landmark. Empty falls back to `paginator.ariaLabel`. */
  readonly ariaLabel = input('');

  /**
   * Fires on every user-driven page or rows change with the full state.
   *
   * Named `paginate`, not `pageChange`: `[(page)]` already owns the implicit `pageChange`
   * output, so a second one would collide and feed this object into the caller's `page`.
   */
  readonly paginate = output<PaginatorState>();

  private readonly slots = contentChildren(PaginatorTemplate);

  /**
   * `rows` reduced to a usable page size. Everything below reads this, never `rows()`, so
   * `NaN` or `Infinity` cannot leak into the state; a constructor effect reconciles the model.
   */
  protected readonly safeRows = computed(() => normalizeRows(this.rows()) ?? 1);

  /** `totalRecords` reduced to a usable count; the raw input can be `NaN`. */
  protected readonly safeTotalRecords = computed(() => normalizeCount(this.totalRecords()));

  /** `pageLinkSize` reduced to a usable window width. */
  protected readonly safePageLinkSize = computed(() => normalizeWindow(this.pageLinkSize()));

  /** Total pages, floored at 1 so an empty set still renders one page. */
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.safeTotalRecords() / this.safeRows())),
  );

  /** `page` clamped into `[1, pageCount]` for all display and slicing. */
  protected readonly currentPage = computed(() => clamp(this.page(), 1, this.pageCount()));

  /** Zero-based index of the first row on the current page. */
  protected readonly first = computed(() => (this.currentPage() - 1) * this.safeRows());

  /** Exclusive end index of the current page, clamped to the total. */
  protected readonly last = computed(() =>
    Math.min(this.first() + this.safeRows(), this.safeTotalRecords()),
  );

  protected readonly state = computed<PaginatorState>(() => ({
    page: this.currentPage(),
    rows: this.safeRows(),
    first: this.first(),
    last: this.last(),
    pageCount: this.pageCount(),
    totalRecords: this.safeTotalRecords(),
  }));

  protected readonly slotContext = computed<PaginatorSlotContext>(() => ({
    $implicit: this.state(),
  }));

  protected readonly firstDisabled = computed(() => this.disabled() || this.currentPage() <= 1);
  protected readonly lastDisabled = computed(
    () => this.disabled() || this.currentPage() >= this.pageCount(),
  );

  protected readonly pageItems = computed(() =>
    buildPageItems(this.currentPage(), this.pageCount(), this.safePageLinkSize()),
  );

  protected readonly rowsOptions = computed<SelectOption<number>[]>(() =>
    this.rowsPerPageOptions()
      // An unusable page size must never be offered as a choice.
      .map(normalizeRows)
      .filter((n): n is number => n !== null)
      .map((n) => ({ label: String(n), value: n })),
  );

  protected readonly jumpOptions = computed<SelectOption<number>[]>(() =>
    Array.from({ length: this.pageCount() }, (_, i) => ({
      label: String(i + 1),
      value: i + 1,
    })),
  );

  /**
   * The `currentReport` string with placeholders substituted.
   *
   * The translated default is passed in rather than read from `TranslocoService` because
   * the template resolves it with `TranslocoPipe`, which yields `''` — never the raw key —
   * while the lazy scope loads. The last-resort literal is language-neutral so no English
   * leaks in that window.
   */
  protected report(translatedTemplate: string): string {
    const s = this.state();
    const displayFirst = s.totalRecords === 0 ? 0 : s.first + 1;
    const template =
      this.currentPageReportTemplate() || translatedTemplate || '{currentPage} / {totalPages}';
    return template
      .replace('{currentPage}', String(s.page))
      .replace('{totalPages}', String(s.pageCount))
      .replace('{first}', String(displayFirst))
      .replace('{last}', String(s.last))
      .replace('{rows}', String(s.rows))
      .replace('{totalRecords}', String(s.totalRecords));
  }

  protected readonly visible = computed(() => this.alwaysShow() || this.pageCount() > 1);

  /**
   * Whether the first paint is behind us. `animate.enter` fires on initial
   * insertion too, not only on later ones, so an ungated binding animates the
   * bar on every page load — motion nobody asked for. Gating on this keeps
   * the entrance for what it is meant for: the bar appearing later, when
   * `alwaysShow` is `false` and the page count crosses 1.
   */
  private readonly rendered = signal(false);

  /** The enter/leave animation classes, suppressed on the first paint. */
  protected readonly enterClass = computed(() => (this.rendered() ? 'paginator-enter' : ''));
  protected readonly leaveClass = computed(() => (this.rendered() ? 'paginator-leave' : ''));

  constructor() {
    afterNextRender(() => {
      this.rendered.set(true);
    });

    // Reconcile an out-of-range external `rows` before `page`, so the page
    // is clamped against the page count the usable size implies. Neither
    // reconciliation emits — they aren't user actions.
    effect(() => {
      const safe = this.safeRows();
      if (untracked(this.rows) !== safe) {
        this.rows.set(safe);
      }
    });

    // Reconcile an out-of-range external `page` (e.g. after `rows` or
    // `totalRecords` shrinks) without emitting — this isn't a user action.
    effect(() => {
      const clamped = this.currentPage();
      if (untracked(this.page) !== clamped) {
        this.page.set(clamped);
      }
    });
  }

  protected slotFor(name: PaginatorSlot) {
    return this.slots().find((t) => t.slot() === name)?.templateRef ?? null;
  }

  protected goTo(page: number | null | undefined): void {
    if (page == null || this.disabled()) {
      return;
    }
    const next = clamp(page, 1, this.pageCount());
    if (next === this.currentPage()) {
      return;
    }
    this.page.set(next);
    this.paginate.emit(this.state());
  }

  protected onRowsChange(rows: number | undefined): void {
    const next = rows == null ? null : normalizeRows(rows);
    if (next === null || next === this.safeRows() || this.disabled()) {
      return;
    }
    // Keep the first visible record on screen across the resize.
    const startIndex = this.first();
    this.rows.set(next);
    this.page.set(clamp(Math.floor(startIndex / next) + 1, 1, this.pageCount()));
    this.paginate.emit(this.state());
  }
}
