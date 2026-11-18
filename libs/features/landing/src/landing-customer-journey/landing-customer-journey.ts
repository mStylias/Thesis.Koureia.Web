import { Component } from '@angular/core';
import { LucideCalendarCheck, LucideMapPin, LucideScissors } from '@lucide/angular';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'lib-landing-customer-journey',
  imports: [LucideCalendarCheck, LucideMapPin, LucideScissors, TranslocoPipe],
  templateUrl: './landing-customer-journey.html',
  styleUrl: './landing-customer-journey.scss',
})
export class LandingCustomerJourney {}
