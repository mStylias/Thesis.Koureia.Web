/**
 * The timing the result cards enter on.
 *
 * Shared because two components must agree on it: the list spends this time, and the map waits
 * it out before it reframes. One filter change starts both, and a camera flying while cards are
 * still arriving puts two unrelated motions on the screen at once.
 */

/** Gap between one card's entrance and the next. */
export const CARD_STAGGER_STEP_MS = 20;

/**
 * How many cards the stagger reaches before every later one shares the last delay.
 *
 * The whole sequence has to land inside the 300ms an interface gets, and the delay is the part
 * that eats it. Raising either number is what turns the effect into a wait — most of a page of
 * 20 shares the final delay, so a high limit buys nothing but a stretch of empty grid before the
 * bulk of the cards appear.
 */
export const CARD_STAGGER_LIMIT = 3;

/** One card's entrance. Mirrors `--dur-base`, which `barbershops-list.scss` animates on. */
export const CARD_ENTER_MS = 180;

/** From the first card's entrance to the last card's settle. */
export const CARD_ENTER_TOTAL_MS = CARD_STAGGER_LIMIT * CARD_STAGGER_STEP_MS + CARD_ENTER_MS;
