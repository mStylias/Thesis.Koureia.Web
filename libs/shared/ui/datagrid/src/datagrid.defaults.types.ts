import type { GridConfig } from './core/types/config.types';

/**
 * The configuration an application standardizes on.
 *
 * Content is deliberately not part of it: `key`, `columns` and `data` describe
 * one screen's records, and an application-wide default for them would be a
 * value every grid silently inherited.
 */
export type DatagridDefaults<TRow = unknown> = Omit<
  Partial<GridConfig<TRow>>,
  'key' | 'columns' | 'data'
>;

/** One configuration layer: the `[config]` object or the injected defaults. */
export type ConfigLayer<TRow> = Partial<GridConfig<TRow>> | DatagridDefaults<TRow> | null;
