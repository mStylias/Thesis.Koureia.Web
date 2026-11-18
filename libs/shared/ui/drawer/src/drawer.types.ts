/**
 * Edge the drawer slides in from. `full` covers the entire viewport
 * (PrimeNG's full-screen mode).
 */
export type DrawerPosition = 'left' | 'right' | 'top' | 'bottom' | 'full';

/**
 * Panel size: width for `left`/`right`, height for `top`/`bottom`.
 * Ignored when the position is `full`.
 */
export type DrawerSize = 'sm' | 'md' | 'lg';

/**
 * How the drawer relates to the rest of the page: `over` floats above
 * the content (default), `push` participates in layout and pushes the
 * sibling content aside — place the drawer inside your own flex/grid
 * container next to that content. Push drawers are always non-modal
 * and ignore the `full` position.
 */
export type DrawerMode = 'over' | 'push';

/**
 * Where the drawer's new content sits against the last: `forward` is deeper (a customer's
 * appointment), `back` is shallower, `none` is the same level (another record, another mode).
 */
export type DrawerSwapDirection = 'forward' | 'back' | 'none';
