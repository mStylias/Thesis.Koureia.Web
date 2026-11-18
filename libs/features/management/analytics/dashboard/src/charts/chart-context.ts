import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import type { AnalyticsPeriodViewDto } from '@api/analytics';
import { ChartTheme } from '@ui/chart';
import { asapScheduler, filter, observeOn, scan } from 'rxjs';

import { createAnalyticsFormat } from '../analytics.format';
import type { Translate } from '../analytics.format.types';
import type { ChartContext } from './options/chart-options.types';

/**
 * The context of the option builders, for the response whose `period` the function returns.
 * `null` until there is a period. It follows the theme, the language and every dictionary load,
 * so every option is built again when a label or a color changes.
 *
 * Call it in an injection context: a field initializer of a tab or a tile.
 */
export function injectChartContext(
  period: () => AnalyticsPeriodViewDto | null | undefined,
): Signal<ChartContext | null> {
  const transloco = inject(TranslocoService);
  const tokens = inject(ChartTheme).tokens;
  // `translate` answers with the key until a dictionary lands, so each load and each language
  // change builds the labels again. A `transloco` pipe can finish a load while a template
  // renders, and a signal write there throws NG0600. The count moves after the render.
  const changes = toSignal(
    transloco.events$.pipe(
      filter((event) => event.type === 'translationLoadSuccess' || event.type === 'langChanged'),
      observeOn(asapScheduler),
      scan((count) => count + 1, 0),
    ),
    { initialValue: 0 },
  );
  const translate: Translate = (key, params) => transloco.translate(key, params);

  return computed(() => {
    const current = period();
    if (!current) return null;
    changes();
    const locale = transloco.getActiveLang();
    return {
      tokens: tokens(),
      t: translate,
      format: createAnalyticsFormat({ locale, currency: current.currency, translate }),
      period: current,
      locale,
    };
  });
}
