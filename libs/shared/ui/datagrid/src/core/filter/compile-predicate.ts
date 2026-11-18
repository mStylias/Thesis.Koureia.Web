/**
 * Compiles a filter tree into a row predicate for local mode.
 *
 * `@ui/data-source`'s implementation, shared with every other data-bound
 * control: local `contains` and the grid's remote `contains` have to agree,
 * and they only do if there is one of them.
 */
export { compileFilterPredicate } from '@ui/data-source';
export type { CompilePredicateOptions } from '@ui/data-source';
