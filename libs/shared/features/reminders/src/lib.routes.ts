import { inject } from '@angular/core';
import type { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { forkJoin, map } from 'rxjs';

import { remindersInlineLoader } from './reminders.i18n';

/** The root dictionary loads too, because the page title is an app-owned `titles.*` key. */
const preloadRemindersTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  const lang = transloco.getActiveLang();

  return forkJoin([
    transloco.load(lang),
    transloco.load(`reminders/${lang}`, { inlineLoader: remindersInlineLoader }),
  ]).pipe(map(() => true));
};

/**
 * The public reminder pages, under `/{lang}/reminders`. Not indexed and not in the sitemap: the
 * app's server routes send `noindex`.
 */
export const remindersRoutes: Route[] = [
  {
    path: 'unsubscribe',
    loadComponent: () =>
      import('./unsubscribe/reminders-unsubscribe').then((m) => m.RemindersUnsubscribe),
    resolve: { translations: preloadRemindersTranslations },
    title: 'titles.reminders.unsubscribe',
  },
];
