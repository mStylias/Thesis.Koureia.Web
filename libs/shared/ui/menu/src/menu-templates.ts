import { Directive, inject, TemplateRef } from '@angular/core';
import { MenuItem } from './menu.types';

/** Template context of `libMenuItem`. */
export interface MenuItemTemplateContext {
  /** The item being rendered. */
  $implicit: MenuItem;
}

/**
 * Custom rendering for menu items, replacing the default
 * icon + label + shortcut row:
 *
 * ```html
 * <lib-context-menu [items]="items">
 *   <ng-template libMenuItem let-item>
 *     <strong>{{ item.label }}</strong>
 *   </ng-template>
 * </lib-context-menu>
 * ```
 */
@Directive({ selector: 'ng-template[libMenuItem]', exportAs: 'libMenuItem' })
export class MenuItemTemplate {
  readonly templateRef = inject<TemplateRef<MenuItemTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: MenuItemTemplate,
    _context: unknown,
  ): _context is MenuItemTemplateContext {
    return true;
  }
}
