import { Component } from '@angular/core';

/**
 * The shape of {@link AppointmentForm} while the services load. Decorative: the panel owns the
 * status announcement.
 */
@Component({
  selector: 'lib-appointment-form-skeleton',
  templateUrl: './appointment-form-skeleton.html',
  styleUrl: './appointment-form-skeleton.scss',
  host: { 'aria-hidden': 'true' },
})
export class AppointmentFormSkeleton {}
