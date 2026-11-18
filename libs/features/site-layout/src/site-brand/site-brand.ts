import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BRAND } from '@util/brand';
import { LangLink } from '@util/language';

/**
 * Wordmark link used by the landing header and the site footer. The logo and the text
 * come from `BRAND`; the accent dot is a design-system flourish rather than
 * brand data, so it is drawn for every tenant.
 *
 * Inherits `color` from its context; override `--wordmark-icon-size` to resize
 * the icon.
 */
@Component({
  selector: 'lib-site-brand',
  imports: [NgOptimizedImage, LangLink, TranslocoPipe],
  template: `
    <a class="brand" langLink="/" [attr.aria-label]="'brand.landing.label' | transloco">
      <img [ngSrc]="brand.logo" width="310" height="310" alt="" />
      <span>{{ brand.wordmark }}<span class="brand-accent">.</span></span>
    </a>
  `,
  styleUrl: './site-brand.scss',
})
export class SiteBrand {
  // Read per injection, never cached at module scope — see `BrandConfig`.
  protected readonly brand = inject(BRAND);
}
