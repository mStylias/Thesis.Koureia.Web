import { provideTranslocoScope } from '@jsverse/transloco';
import { ProgressMode } from './progress.types';

/**
 * The lib's Transloco scope, shared by both indicators.
 *
 * It exists for exactly one reason: an indicator whose consumer passed
 * neither `ariaLabel` nor `ariaLabelledby` must still report a name —
 * `role="progressbar"` takes its name from the author only, so nothing else
 * can supply one, and an unnamed one trips AXE's `aria-progressbar-name`.
 * Declared once so the loader cannot drift between the two components.
 */
export const PROGRESS_TRANSLOCO_SCOPE = provideTranslocoScope({
  scope: 'progress',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
});

/**
 * Translation key for the fallback name, so both indicators word an unnamed
 * `determinate` and an unnamed `indeterminate` the same way.
 */
export const progressNameKey = (mode: ProgressMode): string =>
  mode === 'determinate' ? 'progress.progressLabel' : 'progress.loadingLabel';
