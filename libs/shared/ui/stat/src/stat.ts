import { booleanAttribute, Component, inject, input } from '@angular/core';

import { StatGroup } from './stat-group';

/**
 * One figure on a tile: the value large, its label below. Content projects after the value,
 * for a unit or a decorative icon such as the rating star.
 *
 * Set `--stat-value-size` on the host to resize the value. The default is `var(--text-xl)`.
 * `labelFirst` puts the label above the value.
 *
 * ```ts
 * import { Stat, StatGroup } from '@ui/stat';
 * ```
 *
 * ```html
 * <lib-stat value="4.0" label="1 review">
 *   <svg lucideStar aria-hidden="true"></svg>
 * </lib-stat>
 *
 * <lib-stat labelFirst value="4.853 €" label="Revenue" />
 * ```
 */
@Component({
  selector: 'lib-stat',
  template: `
    <span class="stat-value">{{ value() }}<ng-content /></span>
    <span class="stat-label">{{ label() }}</span>
  `,
  styleUrl: './stat.scss',
  host: {
    // A list item only inside a group: alone, the role would have no list.
    '[attr.role]': 'group === null ? null : "listitem"',
    '[attr.data-label-first]': 'labelFirst() ? "" : null',
  },
})
export class Stat {
  protected readonly group = inject(StatGroup, { optional: true });

  /** The figure, already formatted. */
  readonly value = input.required<string | number>();
  /** What the figure counts. */
  readonly label = input.required<string>();
  /** Shows the label above the value. A screen reader still reads the value first. */
  readonly labelFirst = input(false, { transform: booleanAttribute });
}
