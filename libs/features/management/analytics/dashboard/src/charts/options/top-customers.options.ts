import type { SeriesSetViewDto } from '@api/analytics';

import { NO_VALUE } from '../../analytics.format';
import { seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';
import type { TopCustomerRow } from './top-customers.options.types';

/**
 * `topCustomers` as table rows: the rank, the name, the visits and the spend. The API sorts the
 * customers by spend, then by visits, and this keeps its order. A customer with no name shows
 * `—`, never the id.
 */
export function topCustomerRows(set: SeriesSetViewDto, ctx: ChartContext): TopCustomerRow[] {
  const visits = seriesValues(set, 'visits');
  const spend = seriesValues(set, 'spend');
  return set.axis.items.map((item, index) => ({
    key: item.key,
    rank: index + 1,
    name: item.label ?? NO_VALUE,
    visits: ctx.format.value(visits[index], 'Count'),
    spend: ctx.format.value(spend[index], 'Money'),
  }));
}
