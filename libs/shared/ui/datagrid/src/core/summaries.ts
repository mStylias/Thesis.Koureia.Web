/**
 * Summaries: the bridge between what a host declares and what the query and
 * the local engine understand.
 *
 * A {@link SummaryConfig} is a display decision as much as a computation. The
 * computation travels as an {@link AggregateSpec} — in the query descriptor
 * for a remote source, into the local engine otherwise — and the display side
 * stays here.
 */
import { formatCellText } from './format';
import { aggregateKey } from './local-engine/aggregate';
import type { CustomAggregate } from './local-engine/aggregate.types';
import type { SummaryConfig } from './types/config.types';
import type { AggregateSpec } from './types/query.types';
import type { FormatOptions } from './format.types';

/** The aggregate one summary asks for. */
export function summarySpec(summary: SummaryConfig): AggregateSpec {
  if (summary.type !== 'custom') {
    return { field: summary.field, type: summary.type };
  }
  // A custom aggregate needs an identifier: it is what a remote source is
  // asked for and what the local implementation is registered under.
  return {
    field: summary.field,
    type: 'custom',
    custom: summary.custom ?? `${summary.field}:custom`,
  };
}

/** The result key one summary reads out of a result's aggregates. */
export function summaryKey(summary: SummaryConfig): string {
  return aggregateKey(summarySpec(summary));
}

/** The summaries of one scope. `scope` defaults to `'total'`. */
export function summariesOfScope(
  summaries: readonly SummaryConfig[],
  scope: 'total' | 'group',
): SummaryConfig[] {
  return summaries.filter((summary) => (summary.scope ?? 'total') === scope);
}

/** Aggregate specs for a set of summaries, deduplicated by result key. */
export function summaryAggregateSpecs(summaries: readonly SummaryConfig[]): AggregateSpec[] {
  const byKey = new Map<string, AggregateSpec>();
  for (const summary of summaries) {
    const spec = summarySpec(summary);
    byKey.set(aggregateKey(spec), spec);
  }
  return [...byKey.values()];
}

/** Local implementations of the custom summaries, keyed by their identifier. */
export function customAggregatesOf(
  summaries: readonly SummaryConfig[],
): Record<string, CustomAggregate> {
  const result: Record<string, CustomAggregate> = {};
  for (const summary of summaries) {
    if (summary.type === 'custom' && summary.calculate) {
      result[summarySpec(summary).custom ?? summary.field] = summary.calculate;
    }
  }
  return result;
}

/**
 * Renders a summary value.
 *
 * `valueFormat` formats the number or date; `displayFormat` wraps it, with
 * `{0}` standing for the formatted value — so a host writes `Σύνολο: {0}`
 * without the grid inventing a label syntax.
 */
export function formatSummary(
  summary: SummaryConfig,
  value: unknown,
  options: FormatOptions = {},
): string {
  const text = formatCellText(
    value,
    summary.valueFormat == null
      ? { id: summary.field }
      : { id: summary.field, format: summary.valueFormat },
    options,
  );
  const template = summary.displayFormat;
  return template == null ? text : template.replace('{0}', text);
}
