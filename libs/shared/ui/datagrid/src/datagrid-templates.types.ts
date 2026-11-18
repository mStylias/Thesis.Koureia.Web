import type { GridLoadError } from './core/types/query.types';

/** Context handed to an error renderer. */
export interface DatagridErrorContext {
  $implicit: GridLoadError;
  retry: () => void;
}
