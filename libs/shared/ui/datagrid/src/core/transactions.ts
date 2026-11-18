/**
 * Row-level transactions (§12).
 *
 * `@ui/data-source`'s keyed insert / update / remove, shared with every other
 * data-bound control. Re-exported so `GridApi.applyTransaction` and grid
 * consumers keep one import site.
 */
export { applyRowTransaction } from '@ui/data-source';
export type { TransactionResult } from '@ui/data-source';
