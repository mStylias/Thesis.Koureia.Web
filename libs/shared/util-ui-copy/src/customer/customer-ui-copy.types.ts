import type { customerUiCopyEl } from './customer-ui-copy.el';

/** Replacement text for shared controls, nested by the lib key path. */
export interface UiCopyDictionary {
  readonly [key: string]: string | UiCopyDictionary;
}

/** The shape of `T` with every text widened to `string`, so a second language must match it. */
export type UiCopyShape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : UiCopyShape<T[K]>;
};

/** The customer copy in any language: exactly the keys of the Greek dictionary. */
export type CustomerUiCopy = UiCopyShape<typeof customerUiCopyEl>;
