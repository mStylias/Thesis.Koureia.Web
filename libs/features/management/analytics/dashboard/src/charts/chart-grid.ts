import { Component } from '@angular/core';

/**
 * The grid of a tab's chart cards: one column, two from `md`. A `wide` card spans both. Each card
 * spans two row tracks, its header and its chart, through a subgrid. So the cards of a row get one
 * header height, and their charts get one top and one height.
 *
 * ```html
 * <lib-chart-grid>
 *   <lib-chart-card wide … />
 *   <lib-chart-card … />
 * </lib-chart-grid>
 * ```
 */
@Component({
  selector: 'lib-chart-grid',
  template: '<ng-content />',
  styleUrl: './chart-grid.scss',
})
export class ChartGrid {}
