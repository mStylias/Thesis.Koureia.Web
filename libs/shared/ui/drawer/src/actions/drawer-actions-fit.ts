import type { DrawerActionMode, DrawerActionsFitInput } from './drawer-actions.types';

/**
 * How each bar action draws on the toolbar's line.
 *
 * The steps run from the end of the group: the last caption goes first, then the one before
 * it. When every action is an icon, the last icon moves into the ⋮ menu, then the one before
 * it. The first step that fits wins. An unmeasured toolbar keeps every caption.
 */
export function fitDrawerActions(input: DrawerActionsFitInput): readonly DrawerActionMode[] {
  const { available, icon, shrinkable } = input;
  const first: DrawerActionMode[] = shrinkable.map((caption) => (caption ? 'label' : 'icon'));
  if (available <= 0 || icon <= 0) return first;

  const steps: DrawerActionMode[][] = [first];
  let modes = first;
  for (let index = shrinkable.length - 1; index >= 0; index--) {
    if (!shrinkable[index]) continue;
    modes = modes.map((mode, at) => (at === index ? 'icon' : mode));
    steps.push(modes);
  }
  for (let index = shrinkable.length - 1; index >= 0; index--) {
    modes = modes.map((mode, at) => (at === index ? 'menu' : mode));
    steps.push(modes);
  }
  return steps.find((step) => lineWidth(step, input) <= available) ?? modes;
}

/** Every button on the line, and one gap between each two. */
function lineWidth(modes: readonly DrawerActionMode[], input: DrawerActionsFitInput): number {
  const parts: number[] = [];
  modes.forEach((mode, index) => {
    if (mode === 'label') parts.push(input.widths[index] ?? 0);
    else if (mode === 'icon') parts.push(input.icon);
  });
  if (input.menuRows || modes.includes('menu')) parts.push(input.icon);
  if (input.end > 0) parts.push(input.end);
  const buttons = parts.reduce((sum, width) => sum + width, 0);
  return buttons + input.gap * Math.max(parts.length - 1, 0);
}
