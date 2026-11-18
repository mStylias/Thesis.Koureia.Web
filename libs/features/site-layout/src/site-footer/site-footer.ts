import { Component } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { LangLink } from '@util/language';

import { SiteBrand } from '../site-brand/site-brand';
import { siteLayoutTranslocoScope } from '../site-layout.i18n';

/** The footer of every public page. */
@Component({
  selector: 'lib-site-footer',
  imports: [SiteBrand, LangLink, TranslocoPipe],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  providers: [provideTranslocoScope(siteLayoutTranslocoScope)],
})
export class SiteFooter {
  protected readonly year = new Date().getFullYear();
}
