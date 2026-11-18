import { Component, computed, input } from '@angular/core';
import {
  LucideCalendarCheck,
  LucideCalendarDays,
  LucideCheck,
  LucideLayoutDashboard,
  LucideMapPin,
  LucideScissors,
} from '@lucide/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { LandingReveal } from '../landing-reveal.directive';

export type LandingStepIcon =
  | 'map-pin'
  | 'scissors'
  | 'calendar-check'
  | 'layout-dashboard'
  | 'calendar-days'
  | 'check';

export interface LandingStep {
  icon: LandingStepIcon;
  /** Translation sub-key under `i18nKey`, e.g. `stepOne`. */
  key: string;
}

/** Numbered three-step section shared by the customer journey and the barber workflow. */
@Component({
  selector: 'lib-landing-steps',
  imports: [
    LucideCalendarCheck,
    LucideCalendarDays,
    LucideCheck,
    LucideLayoutDashboard,
    LucideMapPin,
    LucideScissors,
    LandingReveal,
    TranslocoPipe,
  ],
  templateUrl: './landing-steps.html',
  styleUrl: './landing-steps.scss',
})
export class LandingSteps {
  readonly sectionId = input.required<string>();
  /** Translation prefix, e.g. `landing.customerJourney`. */
  readonly i18nKey = input.required<string>();
  readonly steps = input.required<LandingStep[]>();

  protected readonly titleId = computed(() => `${this.sectionId()}-title`);
}
