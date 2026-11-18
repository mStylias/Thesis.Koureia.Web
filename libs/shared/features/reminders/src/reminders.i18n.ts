import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

/** The `reminders` scope: the card, the guide, the Home Screen prompt and the unsubscribe page. */
export const remindersTranslocoScope = {
  scope: 'reminders',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

/** The scoped-loader form, to preload the dictionary before a server render. */
export const remindersInlineLoader = {
  'reminders/el': remindersTranslocoScope.loader.el,
  'reminders/en': remindersTranslocoScope.loader.en,
} satisfies InlineLoader;
