import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LandingCta } from '../landing-cta/landing-cta';
import { LandingFeatures } from '../landing-features/landing-features';
import { LandingStep, LandingSteps } from '../landing-steps/landing-steps';

@Component({
  selector: 'lib-landing-how-it-works',
  imports: [LandingCta, LandingFeatures, LandingSteps, TranslocoPipe],
  templateUrl: './landing-how-it-works.html',
  styleUrl: './landing-how-it-works.scss',
})
export class LandingHowItWorks {
  protected readonly workflowSteps: LandingStep[] = [
    { icon: 'layout-dashboard', key: 'stepOne' },
    { icon: 'calendar-days', key: 'stepTwo' },
    { icon: 'check', key: 'stepThree' },
  ];
}
