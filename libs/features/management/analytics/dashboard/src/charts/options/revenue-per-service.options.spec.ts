import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { categorySet, plainText, testContext } from '../../testing/dashboard.fixtures';
import { isEmptySeriesSet } from './chart-data';
import { revenuePerServiceOption } from './revenue-per-service.options';

describe('revenuePerServiceOption', () => {
  const ctx = testContext();
  const set = categorySet(
    [
      { key: 'cut', label: 'Κουρέματα' },
      { key: 'classic', label: 'Κλασικό', parentKey: 'cut' },
      { key: 'fade', label: 'Fade', parentKey: 'cut' },
      { key: 'beard', label: 'Γενειάδα' },
      { key: 'trim', label: 'Περιποίηση', parentKey: 'beard' },
      { key: 'shave', label: 'Ξύρισμα', parentKey: 'beard' },
      { key: 'uncategorized' },
      { key: 'kids', label: 'Παιδικό', parentKey: 'uncategorized' },
      { key: 'empty' },
    ],
    { revenue: [3060, 2021, 665, 1568, 1274, 0, 225, 225, null] },
    { revenue: 'Money' },
  );

  const treemap = () =>
    (revenuePerServiceOption(set, ctx)['series'] as Record<string, unknown>[])[0] as {
      type: string;
      nodeClick: unknown;
      data: {
        id: string;
        name: string;
        value: number;
        itemStyle: { color: string };
        children: { id: string; name: string; value: number; itemStyle: { color: string } }[];
      }[];
    };

  it('nests the services under their categories', () => {
    expect(treemap().type).toBe('treemap');
    expect(
      treemap().data.map((node) => [node.name, node.children.map((child) => child.id)]),
    ).toEqual([
      ['Κουρέματα', ['classic', 'fade']],
      ['Γενειάδα', ['trim']],
      ['Χωρίς κατηγορία', ['kids']],
    ]);
  });

  it('gives a category its own value, so ECharts does not add the services again', () => {
    expect(treemap().data.map((node) => node.value)).toEqual([3060, 1568, 225]);
  });

  it('leaves out a service of 0 and a category with no value: they have no area', () => {
    expect(
      treemap()
        .data.flatMap((node) => node.children)
        .map((child) => child.id),
    ).not.toContain('shave');
    expect(treemap().data.map((node) => node.id)).not.toContain('empty');
  });

  it('fills a category and its services with one swatch', () => {
    const [cut, beard] = treemap().data;
    expect(cut.itemStyle.color).toBe('swatch-1');
    expect(cut.children.map((child) => child.itemStyle.color)).toEqual(['swatch-1', 'swatch-1']);
    expect(beard.itemStyle.color).toBe('swatch-2');
  });

  it('takes the colors it is given, so both charts of the tab agree', () => {
    const option = revenuePerServiceOption(set, ctx, new Map([['beard', 'swatch-6']]));
    const data = (option['series'] as { data: { itemStyle: { color: string } }[] }[])[0]?.data;
    expect(data[1]?.itemStyle.color).toBe('swatch-6');
  });

  it('gives a category below a tenth of the revenue no name band, so its services fill it', () => {
    const bands = treemap().data.map(
      (node) => (node as unknown as { upperLabel: { show: boolean } }).upperLabel.show,
    );
    // 3060 and 1568 of 4853 have a band. 225 is under a tenth.
    expect(bands).toEqual([true, true, false]);
  });

  it('does not drill down on a click', () => {
    expect(treemap().nodeClick).toBe(false);
  });

  it('shows the path and the revenue in the tooltip', () => {
    const html = (
      revenuePerServiceOption(set, ctx)['tooltip'] as { formatter: Formatter }
    ).formatter({
      name: 'Κλασικό',
      value: 2021,
      color: 'swatch-1',
      treePathInfo: [
        { name: 'Έσοδα', value: 0 },
        { name: 'Κουρέματα', value: 3060 },
        { name: 'Κλασικό', value: 2021 },
      ],
    });
    expect(plainText(html)).toContain('Κουρέματα › Κλασικό');
    expect(plainText(html)).toContain('2.021 €');
  });

  it('reports a set of zeros as empty', () => {
    const zeros = categorySet([{ key: 'cut' }, { key: 'x', parentKey: 'cut' }], {
      revenue: [0, 0],
    });
    expect(isEmptySeriesSet(zeros)).toBe(true);
  });
});
