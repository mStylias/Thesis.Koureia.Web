/**
 * How a preset's options reach its renderer.
 *
 * A renderer component receives one input — the cell context — so a preset's
 * own configuration travels on the column definition, under a namespaced key
 * of `ColumnDef.meta`. That keeps the renderer a plain component type, which
 * is the only form of renderer that survives being passed as a value through a
 * wrapper, and leaves the host's own `meta` entries untouched.
 */
import type { ColumnDef } from '../core/types/column.types';

/** Namespaced so a host's own `meta` keys cannot collide with a preset's. */
const PRESET_META_KEY = 'libDatagridPreset';

/** Attaches a preset's options to a column. */
export function withPresetOptions<TRow>(
  column: ColumnDef<TRow>,
  options: unknown,
): ColumnDef<TRow> {
  return { ...column, meta: { ...column.meta, [PRESET_META_KEY]: options } };
}

/**
 * Reads a preset's options back off a column.
 *
 * The fallback is what the renderer draws when the column was not built by its
 * factory — a renderer written into a template by hand, say. It also carries
 * the option type, so no call site has to name it.
 */
export function readPresetOptions<TOptions>(
  column: Pick<ColumnDef, 'meta'>,
  fallback: TOptions,
): TOptions {
  const options: unknown = column.meta?.[PRESET_META_KEY];
  return options === undefined ? fallback : (options as TOptions);
}
