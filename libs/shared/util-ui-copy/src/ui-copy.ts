import { inject, InjectionToken, Pipe, type PipeTransform, type Provider } from '@angular/core';

import type { UiCopyOverrides, UiCopyResolver } from './ui-copy.types';

/**
 * The copy overrides in force where a control is created. Empty by default, so a control speaks
 * its own copy: the management form, the polite plural.
 */
export const UI_COPY = new InjectionToken<UiCopyOverrides>('UI_COPY', {
  providedIn: 'root',
  factory: () => ({}),
});

/**
 * Replaces shared controls' copy for everything under the provider: a route, a page, a component.
 * A customer-facing route gives the controls the singular this way.
 *
 * ```ts
 * providers: [provideUiCopy({ 'timePicker.placeholder': 'uiCopy.timePicker.placeholder' })]
 * ```
 *
 * A nested provider adds to the one above it, and wins where both name a key.
 */
export function provideUiCopy(overrides: UiCopyOverrides): Provider {
  return {
    provide: UI_COPY,
    useFactory: (): UiCopyOverrides => ({
      ...inject(UI_COPY, { skipSelf: true, optional: true }),
      ...overrides,
    }),
  };
}

/** The key to read in place of a control's own key, for use in TypeScript. */
export function injectUiCopy(): UiCopyResolver {
  const overrides = inject(UI_COPY);
  return (key) => overrides[key] ?? key;
}

/**
 * The key to read in place of a control's own key, for use in a template. Put it in front of the
 * translation:
 *
 * ```html
 * {{ 'timePicker.placeholder' | uiCopy | transloco }}
 * ```
 *
 * Pure: the overrides are fixed for the injector, so a key maps to the same key every time.
 */
@Pipe({ name: 'uiCopy' })
export class UiCopyPipe implements PipeTransform {
  private readonly resolve = injectUiCopy();

  transform(key: string): string {
    return this.resolve(key);
  }
}
