/**
 * Filter tree guards and builders.
 *
 * The tree is `@ui/data-source`'s, so a filter the grid composes is a filter a
 * transport binding translates. Re-exported here so grid code and grid
 * consumers keep one import site.
 */
export { and, isConditionNode, isGroupNode, isNotNode, not, or, where } from '@ui/data-source';
