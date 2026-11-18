import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { Button } from '@ui/button';
import { appBaseUrl, createTermsUrl } from '../../app-home';
import { AuthFrame } from '../../components/auth-frame/auth-frame';
import type { KcContext } from '../../KcContext';
import type { I18n } from '../../i18n';

/**
 * The `TERMS_AND_CONDITIONS` required action: accept the Terms of Service, or decline and be
 * signed out.
 *
 * Keycloak expects the whole document in the `termsText` message, which is an administrator
 * setting and empty until somebody fills it. The document already lives on the site, so this page
 * links there instead and shows `termsText` only when a realm did set one. That keeps one
 * authoritative copy — the same one the register form links to.
 */
@Component({
  selector: 'kc-terms-page',
  imports: [AuthFrame, Button],
  templateUrl: './terms.html',
  styleUrl: './terms.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsPage {
  readonly displayMessage = false;

  protected readonly kcContext =
    inject<Extract<KcContext, { pageId: 'terms.ftl' }>>(KC_LOGIN_CONTEXT);
  protected readonly i18n = inject<I18n>(LOGIN_I18N);

  protected readonly submitting = signal(false);

  protected readonly termsUrl = createTermsUrl(
    appBaseUrl(this.kcContext.properties),
    this.i18n.currentLanguage.languageTag,
  );

  /** The realm's own copy of the document, when an administrator wrote one. */
  protected readonly termsText = this.i18n.msgStr('termsText').trim();
}
