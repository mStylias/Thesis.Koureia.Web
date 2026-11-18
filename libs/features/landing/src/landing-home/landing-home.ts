import { Component } from '@angular/core';
import { LandingAuth } from '../landing-auth/landing-auth';
import { LandingHero } from '../landing-hero/landing-hero';
import { LandingStep, LandingSteps } from '../landing-steps/landing-steps';

@Component({
  selector: 'lib-landing-home',
  imports: [LandingAuth, LandingHero, LandingSteps],
  templateUrl: './landing-home.html',
  styleUrl: './landing-home.scss',
})
export class LandingHome {
  protected readonly journeySteps: LandingStep[] = [
    { icon: 'map-pin', key: 'stepOne' },
    { icon: 'scissors', key: 'stepTwo' },
    { icon: 'calendar-check', key: 'stepThree' },
  ];
}
