/**
 * The motion behind a views reorder.
 *
 * A FLIP with no "First" read of its own: the strip records each tab's
 * `offsetLeft` before the swap, and the swap is what changes it, so the
 * distance is known without measuring a layout twice.
 *
 * Faster than the datagrid's column reorder on purpose: that motion paces a
 * rearrangement the user watches once, at `--dur-slow`. A tab swap happens
 * repeatedly *inside* a drag, and a 260ms slide would still be settling when
 * the next swap arrives — the strip would lag behind the pointer that is
 * driving it.
 */

/** `--dur-fast`. Short enough that a swap has landed before the next one asks. */
const SWAP_DURATION = 140;

/** `--dur-base`, for the release: a longer travel back to the settled place. */
const DROP_DURATION = 180;

/** `--ease-out`: a reorder answers a press, and a press must leave on its own frame. */
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Names the animations this module owns, so a new swap cancels the one in flight. */
const ANIMATION_ID = 'sv-tab-reorder';

/**
 * Plays a tab from `dx` away to where it now sits.
 *
 * Answers the animation, or `null` when there is nothing to play — the caller
 * needs to know when the strip has stopped moving, and under reduced motion
 * that is immediately.
 */
export function slideTabFrom(element: HTMLElement, dx: number): Animation | null {
  return play(element, dx, SWAP_DURATION);
}

/** Plays the released tab from under the pointer back to its settled place. */
export function dropTabFrom(element: HTMLElement, dx: number): Animation | null {
  return play(element, dx, DROP_DURATION);
}

function play(element: HTMLElement, dx: number, duration: number): Animation | null {
  // jsdom implements no Web Animations API, and a script-driven animation
  // misses the global CSS reduced-motion rule, so it asks for itself.
  if (dx === 0 || typeof element.animate !== 'function' || !motionAllowed()) {
    return null;
  }
  try {
    for (const running of element.getAnimations()) {
      if (running.id === ANIMATION_ID) {
        // Two live animations of one property leave the element wherever the
        // older one decides to end.
        running.cancel();
      }
    }
  } catch {
    return null;
  }
  return element.animate([{ transform: `translateX(${dx.toString()}px)` }, { transform: 'none' }], {
    duration,
    easing: EASING,
    id: ANIMATION_ID,
  });
}

/** False when the user asked for less motion. */
function motionAllowed(): boolean {
  return (
    typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
