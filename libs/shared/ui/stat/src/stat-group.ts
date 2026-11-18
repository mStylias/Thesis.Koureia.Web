import { Component } from '@angular/core';

/**
 * A row of {@link Stat} tiles that share the width and wrap on a narrow screen. A list to
 * assistive technology: name it with `aria-label` or `aria-labelledby` on the host.
 *
 * ```html
 * <lib-stat-group aria-labelledby="figures-heading">
 *   <lib-stat [value]="12" label="Completed" />
 *   <lib-stat [value]="3" label="Upcoming" />
 * </lib-stat-group>
 * ```
 */
@Component({
  selector: 'lib-stat-group',
  template: '<ng-content />',
  styleUrl: './stat-group.scss',
  host: { role: 'list' },
})
export class StatGroup {}
