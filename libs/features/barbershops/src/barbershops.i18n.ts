import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const barbershopsTranslocoScope = {
  scope: 'barbershops',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const barbershopsInlineLoader = {
  'barbershops/el': barbershopsTranslocoScope.loader.el,
  'barbershops/en': barbershopsTranslocoScope.loader.en,
} satisfies InlineLoader;
