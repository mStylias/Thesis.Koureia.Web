import { Component } from '@angular/core';

/**
 * The shape of {@link StaffCard} while the list loads. Decorative: the list owns the busy state.
 */
@Component({
  selector: 'lib-staff-card-skeleton',
  templateUrl: './staff-card-skeleton.html',
  styleUrl: './staff-card-skeleton.scss',
  host: { 'aria-hidden': 'true' },
})
export class StaffCardSkeleton {}
