/*
 * Public API of @data/odata-source: an OData endpoint as a `DataSource<T>`.
 *
 * A control imports `@ui/data-source` and never this lib. This is the sibling that implements
 * the contract over a transport, which is what keeps a transport dependency out of the
 * component libraries.
 */

export { odataSource } from './odata-source';
export { ODataRequestError } from './fetch';
export { DEFAULT_KEY_BATCH_SIZE, DEFAULT_MAX_TOP, resolveCapabilities } from './options';

export type {
  ODataCapabilities,
  ODataSourceFetch,
  ODataSourceOptions,
  ResolvedCapabilities,
  UnsupportedReport,
} from './options';

/*
 * The translation surface, exported so a host can build one query the same way the source
 * does — a base filter for a scoped endpoint, or a link that reproduces a grid's view.
 */
export { odataPath, splitProjection } from './translate/field';
export { toODataFilter } from './translate/filter';
export {
  groupOrderBy,
  toAggregate,
  toKeyFilter,
  toOrderBy,
  toSearchFilter,
} from './translate/query-parts';

export type { Projection } from './translate/field';
export type { FilterContext, ODataFilter } from './translate/filter';
export type { AggregateRequest, AggregateTranslation } from './translate/query-parts';
