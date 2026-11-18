import { getDefaultPageComponent, type KcPage } from '@keycloakify/angular/login';
import { UserProfileFormFieldsComponent } from '@keycloakify/angular/login/components/user-profile-form-fields';
import { TemplateComponent } from '@keycloakify/angular/login/template';
import type { ClassKey } from 'keycloakify/login';
import type { KcContext } from './KcContext';

const customClasses = {
  kcInputClass: 'kc-fallback-input',
} satisfies Partial<Record<ClassKey, string>>;

export async function getKcPage(pageId: KcContext['pageId']): Promise<KcPage> {
  switch (pageId) {
    case 'login.ftl': {
      const { LoginPage } = await import('./pages/login/login');
      return customPage(LoginPage);
    }
    case 'register.ftl': {
      const { RegisterPage } = await import('./pages/register/register');
      return customPage(RegisterPage);
    }
    case 'login-reset-password.ftl': {
      const { ForgotPasswordPage } = await import('./pages/forgot-password/forgot-password');
      return customPage(ForgotPasswordPage);
    }
    // Where the emailed reset link lands: Keycloak redirects the action token to
    // `required-action?execution=UPDATE_PASSWORD`, which renders this page.
    case 'login-update-password.ftl': {
      const { UpdatePasswordPage } = await import('./pages/update-password/update-password');
      return customPage(UpdatePasswordPage);
    }
    // The `UPDATE_PROFILE` and `VERIFY_PROFILE` required actions. Tightening a user profile rule
    // sends every account that already breaks it here on its next sign-in.
    case 'login-update-profile.ftl': {
      const { UpdateProfilePage } = await import('./pages/update-profile/update-profile');
      return customPage(UpdateProfilePage);
    }
    case 'terms.ftl': {
      const { TermsPage } = await import('./pages/terms/terms');
      return customPage(TermsPage);
    }
    case 'login-verify-email.ftl': {
      const { VerifyEmailPage } = await import('./pages/verify-email/verify-email');
      return customPage(VerifyEmailPage);
    }
    // The three pages of `first broker login`, which runs when somebody signs in with Google and
    // the address already belongs to a password account.
    case 'login-idp-link-confirm.ftl': {
      const { IdpLinkConfirmPage } = await import('./pages/idp-link-confirm/idp-link-confirm');
      return customPage(IdpLinkConfirmPage);
    }
    case 'login-idp-link-email.ftl': {
      const { IdpLinkEmailPage } = await import('./pages/idp-link-email/idp-link-email');
      return customPage(IdpLinkEmailPage);
    }
    case 'idp-review-user-profile.ftl': {
      const { IdpReviewProfilePage } =
        await import('./pages/idp-review-profile/idp-review-profile');
      return customPage(IdpReviewProfilePage);
    }
    // How every flow above ends when it ends in a message rather than a redirect — the
    // "your account has been updated" page after a password change, among others.
    case 'info.ftl': {
      const { InfoPage } = await import('./pages/info/info');
      return customPage(InfoPage);
    }
    // How they end when they cannot continue at all.
    case 'error.ftl': {
      const { ErrorPage } = await import('./pages/error/error');
      return customPage(ErrorPage);
    }
    case 'login-page-expired.ftl': {
      const { PageExpiredPage } = await import('./pages/page-expired/page-expired');
      return customPage(PageExpiredPage);
    }
    default:
      return {
        PageComponent: await getDefaultPageComponent(pageId),
        TemplateComponent,
        UserProfileFormFieldsComponent,
        doMakeUserConfirmPassword: false,
        doUseDefaultCss: true,
        classes: {},
      };
  }
}

function customPage(PageComponent: KcPage['PageComponent']): KcPage {
  return {
    PageComponent,
    TemplateComponent,
    UserProfileFormFieldsComponent,
    doMakeUserConfirmPassword: false,
    doUseDefaultCss: false,
    classes: customClasses,
  };
}
