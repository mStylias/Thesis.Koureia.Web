import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { SiteHeader } from '@features/site-layout';
import { landingTranslocoScope } from './landing.i18n';

@Component({
  selector: 'lib-landing',
  imports: [RouterOutlet, SiteHeader, TranslocoPipe],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  providers: [provideTranslocoScope(landingTranslocoScope)],
})
export class Landing {}
