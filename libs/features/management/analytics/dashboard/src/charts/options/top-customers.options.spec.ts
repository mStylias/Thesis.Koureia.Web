import { categorySet, plainText, testContext } from '../../testing/dashboard.fixtures';
import { isEmptySeriesSet } from './chart-data';
import { topCustomerRows } from './top-customers.options';

describe('topCustomerRows', () => {
  const ctx = testContext();
  const set = categorySet(
    [
      { key: 'a', label: 'Κώστας Ιατρίδης' },
      { key: 'b', label: null },
      { key: 'c', label: 'Φώτης Βασιλείου' },
    ],
    { spend: [1142.5, 135, 0], visits: [6, 7, null] },
    { spend: 'Money' },
  );

  it('ranks the customers in the order of the API, with formatted values', () => {
    const rows = topCustomerRows(set, ctx).map((row) => ({
      ...row,
      spend: plainText(row.spend),
    }));
    expect(rows).toEqual([
      { key: 'a', rank: 1, name: 'Κώστας Ιατρίδης', visits: '6', spend: '1.142,50 €' },
      { key: 'b', rank: 2, name: '—', visits: '7', spend: '135 €' },
      { key: 'c', rank: 3, name: 'Φώτης Βασιλείου', visits: '—', spend: '0 €' },
    ]);
  });

  it('gives no rows and reports empty when there are no customers', () => {
    const empty = categorySet([], { spend: [], visits: [] });
    expect(topCustomerRows(empty, ctx)).toEqual([]);
    expect(isEmptySeriesSet(empty)).toBe(true);
  });
});
