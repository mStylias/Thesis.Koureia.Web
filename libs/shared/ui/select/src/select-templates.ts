import { Directive, inject, TemplateRef } from '@angular/core';
import { SelectOption } from './select.types';

/** Template context for option and selected-item templates. */
export interface SelectOptionContext<T, TItem = unknown> {
  $implicit: SelectOption<T, TItem>;
}

/**
 * Custom rendering for each option in the dropdown list:
 *
 * ```html
 * <lib-select [options]="cities">
 *   <ng-template libSelectOption let-option>
 *     <img [src]="flagOf(option.value)" alt="" /> {{ option.label }}
 *   </ng-template>
 * </lib-select>
 * ```
 */
@Directive({ selector: 'ng-template[libSelectOption]' })
export class SelectOptionTemplate<T, TItem = unknown> {
  readonly templateRef = inject<TemplateRef<SelectOptionContext<T, TItem>>>(TemplateRef);

  static ngTemplateContextGuard<T, TItem>(
    _directive: SelectOptionTemplate<T, TItem>,
    _context: unknown,
  ): _context is SelectOptionContext<T, TItem> {
    return true;
  }
}

/**
 * Custom rendering for the selected option shown in the closed trigger.
 * Receives the selected `SelectOption` as its implicit context.
 */
@Directive({ selector: 'ng-template[libSelectedItem]' })
export class SelectedItemTemplate<T, TItem = unknown> {
  readonly templateRef = inject<TemplateRef<SelectOptionContext<T, TItem>>>(TemplateRef);

  static ngTemplateContextGuard<T, TItem>(
    _directive: SelectedItemTemplate<T, TItem>,
    _context: unknown,
  ): _context is SelectOptionContext<T, TItem> {
    return true;
  }
}
