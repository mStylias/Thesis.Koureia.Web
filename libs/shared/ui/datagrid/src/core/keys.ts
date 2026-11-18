/**
 * Key resolution.
 *
 * Turns a {@link KeySpec} into a getter that produces a stable primitive for
 * every row. Composite keys serialize to one string so they stay usable as
 * `Map` keys and in persisted state.
 *
 * The implementation is `@ui/data-source`'s, shared with every other
 * data-bound control. Re-exported here so grid code and grid consumers keep
 * one import site.
 */
export { createKeyGetter, keyFields, keyTypeOf, serializeKey } from '@ui/data-source';
