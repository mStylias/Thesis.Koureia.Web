import { Directive, inject, TemplateRef } from '@angular/core';
import type { AutocompleteFooterContext, AutocompleteOptionContext } from './autocomplete.types';

/** Custom presentation for each suggestion. Interactive descendants are not allowed. */
@Directive({ selector: 'ng-template[libAutocompleteOption]' })
export class AutocompleteOptionTemplate<T> {
  readonly templateRef = inject<TemplateRef<AutocompleteOptionContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _directive: AutocompleteOptionTemplate<T>,
    _context: unknown,
  ): _context is AutocompleteOptionContext<T> {
    return true;
  }
}

/** Presentation-only footer for attribution or source information. */
@Directive({ selector: 'ng-template[libAutocompleteFooter]' })
export class AutocompleteFooterTemplate {
  readonly templateRef = inject<TemplateRef<AutocompleteFooterContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: AutocompleteFooterTemplate,
    _context: unknown,
  ): _context is AutocompleteFooterContext {
    return true;
  }
}
