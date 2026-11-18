import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { injectBrand } from '@util/brand';
import { appHomeUrl } from '../../app-home';
import type { I18n } from '../../i18n';
import type { KcContext } from '../../KcContext';
import { themeAssetUrl } from '../../theme-assets';

@Component({
  selector: 'kc-auth-frame',
  templateUrl: './auth-frame.html',
  styleUrl: './auth-frame.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthFrame {
  readonly title = input.required<string>();
  readonly description = input.required<string>();

  protected readonly brand = injectBrand();
  protected readonly i18n = inject<I18n>(LOGIN_I18N);
  private readonly kcContext = inject<KcContext>(KC_LOGIN_CONTEXT);

  constructor() {
    // Claims the viewport rules in `styles.scss`. They sit behind an attribute because a
    // stylesheet cannot tell this frame's thirteen pages from Keycloak's other thirty-three, and on
    // those it hid the page title and stopped the tall ones from scrolling. Set from the frame,
    // not from `main.ts`, so the rules and their one consumer stay together. Nothing has
    // painted yet, so there is no flash.
    inject(DOCUMENT).documentElement.dataset['authFrame'] = '';
  }

  protected appHome(): string {
    return appHomeUrl(this.kcContext, this.i18n);
  }

  protected assetUrl(publicPath: string): string {
    return themeAssetUrl(this.kcContext.url.resourcesPath, publicPath);
  }
}
