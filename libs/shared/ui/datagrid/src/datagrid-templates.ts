/**
 * Host-supplied renderers, declared as `ng-template` directives.
 *
 * Every renderer is recycled: the grid updates an existing view's context
 * rather than guaranteeing a new instance per row, so a renderer must derive
 * everything it shows from its context and keep no per-row state of its own.
 */
import { Directive, TemplateRef, inject, input } from '@angular/core';
import type {
  CellTemplateContext,
  DetailTemplateContext,
  GroupRowTemplateContext,
  HeaderTemplateContext,
  SummaryCellTemplateContext,
} from './core/types/context.types';
import type { CardTemplateContext } from './core/types/card.types';
import type { DatagridErrorContext } from './datagrid-templates.types';
/**
 * Cell renderer for one column.
 *
 * ```html
 * <ng-template libDatagridCell="status" let-cell>
 *   <lib-badge>{{ cell.displayValue }}</lib-badge>
 * </ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[libDatagridCell]' })
export class DatagridCellTemplate<TRow = unknown> {
  /** Id of the column this renderer draws. */
  readonly libDatagridCell = input.required<string>();

  readonly template = inject<TemplateRef<CellTemplateContext<TRow>>>(TemplateRef);

  static ngTemplateContextGuard<TRow>(
    _directive: DatagridCellTemplate<TRow>,
    _context: unknown,
  ): _context is CellTemplateContext<TRow> {
    return true;
  }
}

/**
 * Header renderer for one column.
 *
 * ```html
 * <ng-template libDatagridHeader="status" let-header>{{ header.column.caption }}</ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[libDatagridHeader]' })
export class DatagridHeaderTemplate<TRow = unknown> {
  /** Id of the column this renderer draws. */
  readonly libDatagridHeader = input.required<string>();

  readonly template = inject<TemplateRef<HeaderTemplateContext<TRow>>>(TemplateRef);

  static ngTemplateContextGuard<TRow>(
    _directive: DatagridHeaderTemplate<TRow>,
    _context: unknown,
  ): _context is HeaderTemplateContext<TRow> {
    return true;
  }
}

/**
 * Group header renderer.
 *
 * The directive's value is the id of the grouped column, or empty for every
 * group the grid draws.
 *
 * ```html
 * <ng-template libDatagridGroup="branch" let-group>
 *   {{ group.displayValue }} — {{ group.count }}
 * </ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[libDatagridGroup]' })
export class DatagridGroupTemplate<TRow = unknown> {
  /** Id of the grouped column, or `''` for every group. */
  readonly libDatagridGroup = input('');

  readonly template = inject<TemplateRef<GroupRowTemplateContext<TRow>>>(TemplateRef);

  static ngTemplateContextGuard<TRow>(
    _directive: DatagridGroupTemplate<TRow>,
    _context: unknown,
  ): _context is GroupRowTemplateContext<TRow> {
    return true;
  }
}

/**
 * Row detail renderer. Declaring one is what makes rows expandable; the
 * content is instantiated on first expansion and destroyed on collapse.
 *
 * ```html
 * <ng-template libDatagridDetail let-detail>
 *   <app-booking-detail [booking]="detail.row" />
 * </ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[libDatagridDetail]' })
export class DatagridDetailTemplate<TRow = unknown> {
  readonly template = inject<TemplateRef<DetailTemplateContext<TRow>>>(TemplateRef);

  static ngTemplateContextGuard<TRow>(
    _directive: DatagridDetailTemplate<TRow>,
    _context: unknown,
  ): _context is DetailTemplateContext<TRow> {
    return true;
  }
}

/**
 * Renderer for the summary cell under one column, in the grid footer and in
 * group footers alike.
 *
 * ```html
 * <ng-template libDatagridSummary="price" let-summary>
 *   <strong>{{ summary.displayValue }}</strong>
 * </ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[libDatagridSummary]' })
export class DatagridSummaryTemplate<TRow = unknown> {
  /** Id of the column this summary aligns under. */
  readonly libDatagridSummary = input.required<string>();

  readonly template = inject<TemplateRef<SummaryCellTemplateContext<TRow>>>(TemplateRef);

  static ngTemplateContextGuard<TRow>(
    _directive: DatagridSummaryTemplate<TRow>,
    _context: unknown,
  ): _context is SummaryCellTemplateContext<TRow> {
    return true;
  }
}

/**
 * Renderer for a whole card in the card view (§5.4), which replaces the fields
 * the grid would have resolved from the columns.
 *
 * ```html
 * <ng-template libDatagridCard let-card>
 *   <app-booking-card [booking]="card.row" />
 * </ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[libDatagridCard]' })
export class DatagridCardTemplate<TRow = unknown> {
  readonly template = inject<TemplateRef<CardTemplateContext<TRow>>>(TemplateRef);

  static ngTemplateContextGuard<TRow>(
    _directive: DatagridCardTemplate<TRow>,
    _context: unknown,
  ): _context is CardTemplateContext<TRow> {
    return true;
  }
}

/** Replaces the "no data at all" state. */
@Directive({ selector: 'ng-template[libDatagridEmpty]' })
export class DatagridEmptyTemplate {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** Replaces the "no results for the current filter" state. */
@Directive({ selector: 'ng-template[libDatagridNoResults]' })
export class DatagridNoResultsTemplate {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** Replaces the load-failure state, including its retry affordance. */
@Directive({ selector: 'ng-template[libDatagridError]' })
export class DatagridErrorTemplate {
  readonly template = inject<TemplateRef<DatagridErrorContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: DatagridErrorTemplate,
    _context: unknown,
  ): _context is DatagridErrorContext {
    return true;
  }
}

/** Replaces the initial-load skeleton. */
@Directive({ selector: 'ng-template[libDatagridLoading]' })
export class DatagridLoadingTemplate {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * A toolbar item. Declare one per control; the grid places it in the region
 * named by the directive's value and renders the toolbar only when at least
 * one item exists.
 *
 * ```html
 * <ng-template libDatagridToolbar="end">
 *   <button libButton size="sm" (click)="grid.reload()">Refresh</button>
 * </ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[libDatagridToolbar]' })
export class DatagridToolbarTemplate {
  /** Region this item belongs to. Defaults to `'start'`. */
  readonly location = input<'start' | 'center' | 'end', '' | 'start' | 'center' | 'end'>('start', {
    alias: 'libDatagridToolbar',
    transform: (value) => (value === '' ? 'start' : value),
  });

  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}
