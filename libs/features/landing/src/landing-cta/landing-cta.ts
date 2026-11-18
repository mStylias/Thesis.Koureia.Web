import { Component } from '@angular/core';
import { LucideArrowRight, LucideCheck } from '@lucide/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { LangLink } from '@util/language';

@Component({
  selector: 'lib-landing-cta',
  imports: [Button, LucideArrowRight, LucideCheck, LangLink, TranslocoPipe],
  templateUrl: './landing-cta.html',
  styleUrl: './landing-cta.scss',
})
export class LandingCta {}
