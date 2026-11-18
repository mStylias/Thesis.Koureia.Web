import { Component } from '@angular/core';
import { LucideBellRing, LucideCalendarDays, LucideSmartphone } from '@lucide/angular';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'lib-landing-features',
  imports: [LucideBellRing, LucideCalendarDays, LucideSmartphone, TranslocoPipe],
  templateUrl: './landing-features.html',
  styleUrl: './landing-features.scss',
})
export class LandingFeatures {}
