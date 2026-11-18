import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const rolesTranslocoScope = {
  scope: 'managementRoles',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const rolesInlineLoader = {
  'managementRoles/el': rolesTranslocoScope.loader.el,
  'managementRoles/en': rolesTranslocoScope.loader.en,
} satisfies InlineLoader;
