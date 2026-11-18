import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { forkJoin, map } from 'rxjs';

import { VerifyEmail } from './verify-email/verify-email';
import { verifyEmailInlineLoader } from './verify-email/verify-email.i18n';

/**
 * Resolves translations before the server render. The root dictionary loads alongside the scope
 * because the page title is an app-owned `titles.*` key.
 */
const preloadVerifyEmailTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  const lang = transloco.getActiveLang();

  return forkJoin([
    transloco.load(lang),
    transloco.load(`verifyEmail/${lang}`, { inlineLoader: verifyEmailInlineLoader }),
  ]).pipe(map(() => true));
};

export const verifyEmailRoutes: Route[] = [
  {
    path: '',
    component: VerifyEmail,
    resolve: { translations: preloadVerifyEmailTranslations },
    title: 'titles.verifyEmail',
  },
];
