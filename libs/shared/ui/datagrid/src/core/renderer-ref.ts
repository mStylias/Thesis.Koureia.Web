/**
 * Renderer resolution.
 *
 * A {@link RendererRef} is a template or a component type. Both branches
 * resolve here, so a renderer carried as a value in a `ColumnDef` and one
 * declared as a directive cannot disagree about which branch they took.
 *
 * The component branch is what survives a wrapper: a component class is a
 * symbol another module can import, where a template belongs to the view that
 * declares it and no amount of projection moves it.
 */
import { TemplateRef } from '@angular/core';
import type { RendererRef } from './types/column.types';
import type { ResolvedRenderer } from './renderer-ref.types';

/** Shared for the common case, so resolution allocates nothing. */
const NO_RENDERER = { template: null, component: null };

/** Splits a renderer reference into its template and component branches. */
export function resolveRenderer<TContext>(
  ref: RendererRef | null | undefined,
): ResolvedRenderer<TContext> {
  if (ref == null) {
    return NO_RENDERER;
  }
  return ref instanceof TemplateRef
    ? // `RendererRef` is context-agnostic by declaration; the slot names the
      // context it supplies.
      { template: ref as TemplateRef<TContext>, component: null }
    : { template: null, component: ref };
}

/** The empty resolution, for a column that declares no renderer. */
export function noRenderer<TContext>(): ResolvedRenderer<TContext> {
  return NO_RENDERER;
}
