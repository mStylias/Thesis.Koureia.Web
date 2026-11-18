import { Component } from '@angular/core';

/**
 * The shape of {@link AppointmentView} while the appointment loads. Decorative: the panel owns
 * the status announcement.
 */
@Component({
  selector: 'lib-appointment-view-skeleton',
  templateUrl: './appointment-view-skeleton.html',
  styleUrl: './appointment-view-skeleton.scss',
  host: { 'aria-hidden': 'true' },
})
export class AppointmentViewSkeleton {}
