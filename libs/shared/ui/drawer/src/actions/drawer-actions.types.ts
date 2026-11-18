import type { UrlTree } from '@angular/router';
import type { LucideIconInput } from '@lucide/angular';
import type { ButtonSeverity, ButtonVariant } from '@ui/button';

/** One action of a drawer toolbar's left group. */
export interface DrawerAction {
  /** Stable across renders, so a button keeps its element while its label changes. */
  readonly id: string;
  /** Translated text: the caption, or the tooltip and the name of the icon button and the ⋮ row. */
  readonly label: string;
  readonly icon: LucideIconInput;
  /** Defaults to `secondary`. `error` also draws the ⋮ row in the error colour. */
  readonly severity?: ButtonSeverity;
  /** Defaults to `outlined`. */
  readonly variant?: ButtonVariant;
  /** Always an icon button, never a caption. */
  readonly iconOnly?: boolean;
  /** Always a ⋮ row, never a button. */
  readonly menuOnly?: boolean;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  /** Draws the action as a link, so it can open in a new tab. A disabled link draws as a button. */
  readonly link?: UrlTree;
  /** Runs on activation. Required without `link`. A link only navigates and never calls it. */
  readonly run?: () => void;
}

/** How one action draws: with its caption, as an icon button, or as a ⋮ row. */
export type DrawerActionMode = 'label' | 'icon' | 'menu';

/** What the toolbar measured, in pixels. */
export interface DrawerActionsFitInput {
  /** The width of the toolbar's line. `0` when it is not measured yet. */
  readonly available: number;
  readonly gap: number;
  /** The width of the end slot: Edit, or Cancel and Save. `0` when it is empty. */
  readonly end: number;
  /** The width of an icon button. The ⋮ trigger takes the same. */
  readonly icon: number;
  /** Each bar action's width with its caption, in order. */
  readonly widths: readonly number[];
  /** Whether each bar action has a caption to give up. */
  readonly shrinkable: readonly boolean[];
  /** Whether the ⋮ menu has rows of its own, so its trigger shows in any case. */
  readonly menuRows: boolean;
}
