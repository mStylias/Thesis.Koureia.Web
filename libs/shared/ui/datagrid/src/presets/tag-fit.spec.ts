import { fitTagCount } from './tag-fit';

/** A `+n` tag 24px wide, whatever `n` is. */
const MORE = (): number => 24;

describe('fitTagCount', () => {
  it('shows every tag, and no "+n", when all of them fit', () => {
    expect(fitTagCount([60, 60, 60], 188, 4, MORE)).toBe(3);
  });

  it('collapses only the tags that do not fit beside the "+n" tag', () => {
    // 60 + 4 + 60 + 4 + 24 = 152 fits in 160. A third tag would need 188.
    expect(fitTagCount([60, 60, 60], 160, 4, MORE)).toBe(2);
  });

  it('keeps room for the "+n" tag when it drops the last tag', () => {
    // Two tags fit alone (124), but not beside "+1" (152), so one shows with "+2".
    expect(fitTagCount([60, 60, 60], 140, 4, MORE)).toBe(1);
  });

  it('never shows "+n" alone: the first tag stays and ellipses', () => {
    expect(fitTagCount([200, 60], 100, 4, MORE)).toBe(1);
  });

  it('shows a single tag even in no space', () => {
    expect(fitTagCount([60], 10, 4, MORE)).toBe(1);
  });

  it('shows nothing for no tags', () => {
    expect(fitTagCount([], 100, 4, MORE)).toBe(0);
  });
});
