import {
  customAggregatesOf,
  formatSummary,
  summariesOfScope,
  summaryAggregateSpecs,
  summaryKey,
  summarySpec,
} from './summaries';
import type { SummaryConfig } from './types/config.types';

describe('summarySpec', () => {
  it('maps a built-in aggregate straight across', () => {
    expect(summarySpec({ field: 'price', type: 'sum' })).toEqual({ field: 'price', type: 'sum' });
  });

  it('keeps the identifier a custom aggregate declares', () => {
    expect(summarySpec({ field: 'price', type: 'custom', custom: 'median' }).custom).toBe('median');
  });

  // A custom aggregate with no identifier could reach neither a remote source
  // nor a local implementation, so one is derived from the field.
  it('derives an identifier for a custom aggregate that declares none', () => {
    expect(summarySpec({ field: 'price', type: 'custom' }).custom).toBe('price:custom');
  });
});

describe('summaryKey', () => {
  it('reads a built-in aggregate under field and type', () => {
    expect(summaryKey({ field: 'price', type: 'avg' })).toBe('price:avg');
  });

  it('reads a custom aggregate under its identifier', () => {
    expect(summaryKey({ field: 'price', type: 'custom', custom: 'median' })).toBe('median');
  });
});

describe('summariesOfScope', () => {
  const summaries: SummaryConfig[] = [
    { field: 'a', type: 'sum' },
    { field: 'b', type: 'sum', scope: 'group' },
    { field: 'c', type: 'sum', scope: 'total' },
  ];

  it('treats an absent scope as total', () => {
    expect(summariesOfScope(summaries, 'total').map((entry) => entry.field)).toEqual(['a', 'c']);
  });

  it('picks the group scope', () => {
    expect(summariesOfScope(summaries, 'group').map((entry) => entry.field)).toEqual(['b']);
  });
});

describe('summaryAggregateSpecs', () => {
  it('deduplicates summaries that ask for the same aggregate', () => {
    const specs = summaryAggregateSpecs([
      { field: 'price', type: 'sum' },
      { field: 'price', type: 'sum', scope: 'group' },
      { field: 'price', type: 'avg' },
    ]);
    expect(specs).toHaveLength(2);
  });
});

describe('customAggregatesOf', () => {
  it('registers a local implementation under its identifier', () => {
    const calculate = (values: readonly unknown[]): unknown => values.length;
    const registry = customAggregatesOf([
      { field: 'price', type: 'custom', custom: 'median', calculate },
      { field: 'price', type: 'sum' },
    ]);
    expect(Object.keys(registry)).toEqual(['median']);
    expect(registry['median']([1, 2])).toBe(2);
  });

  it('registers a custom summary with no identifier under the derived one', () => {
    const registry = customAggregatesOf([{ field: 'price', type: 'custom', calculate: () => 1 }]);
    expect(Object.keys(registry)).toEqual(['price:custom']);
  });
});

describe('formatSummary', () => {
  it('renders a plain number', () => {
    expect(formatSummary({ field: 'n', type: 'sum' }, 1234, { locale: 'en-US' })).toBe('1,234');
  });

  it('applies the value format', () => {
    const text = formatSummary(
      { field: 'n', type: 'sum', valueFormat: { type: 'currency', currency: 'EUR', precision: 0 } },
      1234,
      { locale: 'en-US' },
    );
    expect(text).toContain('1,234');
    expect(text).toContain('€');
  });

  it('wraps the formatted value in the display format', () => {
    expect(
      formatSummary({ field: 'n', type: 'sum', displayFormat: 'Total: {0}' }, 5, {
        locale: 'en-US',
      }),
    ).toBe('Total: 5');
  });

  it('renders an absent aggregate as empty rather than as null', () => {
    expect(formatSummary({ field: 'n', type: 'sum' }, null)).toBe('');
  });
});
