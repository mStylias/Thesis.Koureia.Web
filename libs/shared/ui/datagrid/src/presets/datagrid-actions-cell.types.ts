import type { RowAction } from './preset.types';

/** One action resolved against the row it draws on. */
export interface ResolvedAction<TRow> {
  action: RowAction<TRow>;
  disabled: boolean;
}
