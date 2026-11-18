import type { LocalEngineOptions as SharedEngineOptions } from '@ui/data-source';
import type { CustomAggregate } from './aggregate.types';

/** Host hooks the engine consults. All optional. */
export interface LocalEngineOptions<TRow = unknown> extends SharedEngineOptions<TRow> {
  /** Local implementations of custom aggregates, by identifier. */
  customAggregates?: Readonly<Record<string, CustomAggregate>>;
}
