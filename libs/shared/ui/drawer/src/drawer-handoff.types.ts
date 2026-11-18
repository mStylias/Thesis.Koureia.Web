import type { DrawerSwapDirection } from './drawer.types';

/** A toolbar button as the leaving drawer drew it, in viewport pixels. */
export interface DrawerToolbarMark {
  /** The accessible name, or the caption without one. */
  readonly label: string;
  readonly left: number;
  readonly width: number;
}

/** What a leaving drawer passes to the drawer that takes its place. */
export interface DrawerHandoffPass {
  readonly direction: DrawerSwapDirection;
  /** The leaving toolbar's buttons. A button drawn the same in the same place does not move. */
  readonly toolbar: readonly DrawerToolbarMark[];
}

/** A pass, with when it was made, so one that no drawer took expires. */
export interface TimedDrawerHandoffPass extends DrawerHandoffPass {
  readonly at: number;
}
