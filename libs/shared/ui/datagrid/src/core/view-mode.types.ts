import type { Signal } from '@angular/core';
import type { DatagridBreakpoint, DatagridView, ResolvedDatagridView } from './types/card.types';

/** What {@link ViewMode} reads. Getters, so field order in the shell is free. */
export interface ViewModeDeps {
  /** What the host asked for: a fixed presentation, or `'auto'`. */
  readonly declared: Signal<DatagridView>;
  /** Below this breakpoint `'auto'` resolves to cards. */
  readonly breakpoint: Signal<DatagridBreakpoint>;
  /** Reports a presentation change, so the grid can announce it. */
  readonly onChanged: (view: ResolvedDatagridView) => void;
}
