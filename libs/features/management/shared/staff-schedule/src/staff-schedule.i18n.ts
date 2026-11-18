import type { InlineLoader, TranslocoScope, TranslocoService } from '@jsverse/transloco';
import type { Observable } from 'rxjs';

export const staffScheduleTranslocoScope = {
  scope: 'managementStaffSchedule',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const staffScheduleInlineLoader = {
  'managementStaffSchedule/el': staffScheduleTranslocoScope.loader.el,
  'managementStaffSchedule/en': staffScheduleTranslocoScope.loader.en,
} satisfies InlineLoader;

/**
 * The dictionary in the active language. A host page must load it before it renders: the
 * components translate day names and labels imperatively.
 */
export function loadStaffScheduleDictionaries(transloco: TranslocoService): Observable<unknown> {
  return transloco.load(`managementStaffSchedule/${transloco.getActiveLang()}`, {
    inlineLoader: staffScheduleInlineLoader,
  });
}
