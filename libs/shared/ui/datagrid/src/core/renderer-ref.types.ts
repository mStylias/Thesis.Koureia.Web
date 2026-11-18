import type { TemplateRef, Type } from '@angular/core';

/** A renderer split into the two branches the view renders from. */
export interface ResolvedRenderer<TContext> {
  template: TemplateRef<TContext> | null;
  component: Type<unknown> | null;
}
