import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TRANSLOCO_SCOPE, TranslocoService } from '@jsverse/transloco';
import { injectUiCopy } from '@util/ui-copy';
import { asapScheduler, map, merge, observeOn } from 'rxjs';

/**
 * Translates a calendar key through the consumer's copy overrides. Call it in a `computed`: it
 * reads again when a dictionary lands, and gives `''` until then, not the key and no warning.
 *
 * Not `translateSignal`: it prefixes the scope, so it cannot read an override key from another
 * dictionary.
 */
export function injectCalendarCopy(): (key: string, params?: Record<string, unknown>) => string {
  const transloco = inject(TranslocoService);
  const copy = injectUiCopy();
  const changes = toSignal(
    merge(
      // Loads the calendar scope for each language, as a pipe does.
      transloco.selectTranslate('', {}, inject(TRANSLOCO_SCOPE)),
      // An override can live in a dictionary that lands later. A pipe can load one while it
      // renders, so the event arrives after the render, not inside it.
      transloco.events$.pipe(observeOn(asapScheduler)),
    ).pipe(map(() => ({}))),
    { initialValue: {} },
  );
  const fallback = transloco.config.fallbackLang;
  return (key, params) => {
    changes();
    const resolved = copy(key);
    // Looked up first: `translate` on a key whose dictionary has not landed logs a missing
    // translation, once per key per render, for a gap the next render fills.
    const lang = [
      transloco.getActiveLang(),
      ...(typeof fallback === 'string' ? [fallback] : []),
    ].find((candidate) => resolved in transloco.getTranslation(candidate));
    return lang === undefined ? '' : transloco.translate(resolved, params, lang);
  };
}
