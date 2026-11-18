import { formatPropertyPath, parsePropertyPath } from './index';

describe('parsePropertyPath', () => {
  it('parses simple dotted paths', () => {
    expect(parsePropertyPath('address.street')).toEqual(['address', 'street']);
  });

  it('parses indexers as numbers', () => {
    expect(parsePropertyPath('items[2].name')).toEqual(['items', 2, 'name']);
  });

  it('parses a bare member', () => {
    expect(parsePropertyPath('name')).toEqual(['name']);
  });

  it('parses consecutive indexers', () => {
    expect(parsePropertyPath('matrix[1][2]')).toEqual(['matrix', 1, 2]);
  });

  it('returns empty for an empty path', () => {
    expect(parsePropertyPath('')).toEqual([]);
  });
});

describe('formatPropertyPath', () => {
  it('round-trips the canonical form', () => {
    for (const path of ['address.street', 'items[2].name', 'name', 'matrix[1][2]']) {
      expect(formatPropertyPath(parsePropertyPath(path))).toBe(path);
    }
  });
});
