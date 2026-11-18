import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { CompanyStaffMemberViewDto } from '../../data/barbershops.api.types';

/**
 * The shop's bookable barbers: a photo, or their initials, and the name they go by. Not links:
 * choosing a barber is the booking page's job.
 */
@Component({
  selector: 'lib-barbershop-barbers',
  templateUrl: './barbershop-barbers.html',
  styleUrl: './barbershop-barbers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopBarbers {
  readonly barbers = input.required<readonly CompanyStaffMemberViewDto[]>();
}
