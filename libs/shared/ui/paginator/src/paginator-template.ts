import { Directive, inject, input, TemplateRef } from '@angular/core';
import { PaginatorSection, PaginatorState } from './paginator.types';

/** Slots that can be overridden with a custom template. */
export type PaginatorSlot = PaginatorSection | 'container';

/** The context passed to every paginator template slot. */
export interface PaginatorSlotContext {
  /** The full pagination state. */
  readonly $implicit: PaginatorState;
}

/**
 * Overrides the rendered content of a paginator section. Mark an
 * `<ng-template>` with `libPaginatorTemplate` and the slot name; the
 * template receives the current {@link PaginatorState} as its implicit
 * context.
 *
 * ```html
 * <lib-paginator [(page)]="page" [rows]="10" [totalRecords]="120">
 *   <ng-template libPaginatorTemplate="currentReport" let-s>
 *     Showing {{ s.first + 1 }}–{{ s.last }} of {{ s.totalRecords }}
 *   </ng-template>
 * </lib-paginator>
 * ```
 *
 * The `container` slot replaces the entire body (you lay out the pieces
 * yourself); all other slots replace just that one section in place.
 */
@Directive({
  selector: 'ng-template[libPaginatorTemplate]',
})
export class PaginatorTemplate {
  /** Which slot this template fills. */
  readonly slot = input.required<PaginatorSlot>({ alias: 'libPaginatorTemplate' });

  readonly templateRef = inject<TemplateRef<PaginatorSlotContext>>(TemplateRef);

  /** Type guard for the template context, enabling `let-` type checking. */
  static ngTemplateContextGuard(
    _dir: PaginatorTemplate,
    _context: unknown,
  ): _context is PaginatorSlotContext {
    return true;
  }
}
