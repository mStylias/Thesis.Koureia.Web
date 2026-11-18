import type { Provider } from '@angular/core';

import { provideUiCopy } from '../ui-copy';
import type { UiCopyOverrides } from '../ui-copy.types';
import { customerUiCopyEl } from './customer-ui-copy.el';
import type { UiCopyDictionary } from './customer-ui-copy.types';

/** The root dictionary branch that holds the customer copy. */
export const CUSTOMER_UI_COPY_BRANCH = 'uiCopy';

/**
 * Flattens a copy dictionary into overrides: `{ timePicker: { placeholder } }` becomes
 * `{ 'timePicker.placeholder': 'uiCopy.timePicker.placeholder' }`.
 */
export function uiCopyOverrides(
  dictionary: UiCopyDictionary,
  branch: string = CUSTOMER_UI_COPY_BRANCH,
): UiCopyOverrides {
  const overrides: Record<string, string> = {};
  const walk = (node: UiCopyDictionary, path: string): void => {
    for (const [key, value] of Object.entries(node)) {
      const libKey = path === '' ? key : `${path}.${key}`;
      if (typeof value === 'string') overrides[libKey] = `${branch}.${libKey}`;
      else walk(value, libKey);
    }
  };
  walk(dictionary, '');
  return overrides;
}

/** The customer override map, built from the keys of the Greek dictionary. */
export function customerUiCopy(): UiCopyOverrides {
  return uiCopyOverrides(customerUiCopyEl);
}

/**
 * Gives shared controls the customer singular for everything under the provider. The root
 * dictionary must carry `customerUiCopyEl` and `customerUiCopyEn` under `uiCopy`.
 *
 * ```ts
 * import { customerUiCopyEl, provideCustomerUiCopy } from '@util/ui-copy';
 *
 * { path: ':lang', providers: [provideCustomerUiCopy()], … }
 * const el = { …, uiCopy: customerUiCopyEl };
 * ```
 */
export function provideCustomerUiCopy(): Provider {
  return provideUiCopy(customerUiCopy());
}
