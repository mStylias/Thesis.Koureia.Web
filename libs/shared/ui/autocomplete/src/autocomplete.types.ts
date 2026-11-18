import type { DataKey } from '@ui/data-source';

/** Control density, aligned with the other design-system fields. */
export type AutocompleteSize = 'sm' | 'md' | 'lg';

/** A user-committed selection. */
export interface AutocompleteSelection<T> {
  readonly key: DataKey;
  readonly item: T;
}

/** Why a persisted key could not be resolved into display data. */
export type AutocompleteResolutionFailureReason = 'notFound' | 'loadFailed' | 'unsupported';

/** A persisted value retained by the form but unavailable for display. */
export interface AutocompleteResolutionFailure {
  readonly key: DataKey;
  readonly reason: AutocompleteResolutionFailureReason;
  readonly cause?: unknown;
}

/** Context supplied to a custom option template. */
export interface AutocompleteOptionContext<T> {
  readonly $implicit: T;
  readonly query: string;
}

/** Context supplied to the optional presentation-only panel footer. */
export interface AutocompleteFooterContext {
  readonly query: string;
  readonly loading: boolean;
  readonly hasMore: boolean;
}
