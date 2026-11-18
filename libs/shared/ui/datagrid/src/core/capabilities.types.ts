import type { GridCapability } from './types/config.types';

/** A resolved mask: every capability answered, none absent. */
export type GridCapabilityMask = Readonly<Record<GridCapability, boolean>>;
