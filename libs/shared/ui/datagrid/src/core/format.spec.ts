import { formatCellText, resolveCellValue, resolveDisplayValue } from './format';
import type { ColumnDef } from './types/column.types';

interface Row {
  a: number;
  b: number;
  name: string;
  nested: { value: number };
}

describe('resolveCellValue', () => {
  it('prefers column.value(row) over field', () => {
    const column: ColumnDef<Row> = { id: 'x', value: (row) => row.a, field: 'b' };
    const row: Row = { a: 1, b: 2, name: 'n', nested: { value: 9 } };
    expect(resolveCellValue(row, column)).toBe(1);
  });

  it('reads a dot-path field', () => {
    const column: ColumnDef<Row> = { id: 'x', field: 'nested.value' };
    const row: Row = { a: 1, b: 2, name: 'n', nested: { value: 9 } };
    expect(resolveCellValue(row, column)).toBe(9);
  });

  it('returns undefined when neither value nor field is declared', () => {
    const column: ColumnDef<Row> = { id: 'x' };
    const row: Row = { a: 1, b: 2, name: 'n', nested: { value: 9 } };
    expect(resolveCellValue(row, column)).toBeUndefined();
  });
});

describe('resolveDisplayValue', () => {
  it('calls the display function with the row', () => {
    const column: ColumnDef<Row> = { id: 'x', display: (row) => row.name };
    const row: Row = { a: 1, b: 2, name: 'Ada', nested: { value: 9 } };
    expect(resolveDisplayValue(row, column, 'ignored')).toBe('Ada');
  });

  it('reads a display string as a dot path', () => {
    const column: ColumnDef<Row> = { id: 'x', display: 'nested.value' };
    const row: Row = { a: 1, b: 2, name: 'Ada', nested: { value: 9 } };
    expect(resolveDisplayValue(row, column, 'ignored')).toBe(9);
  });

  it('returns the passed-in value unchanged when no display is declared', () => {
    const column: ColumnDef<Row> = { id: 'x' };
    const row: Row = { a: 1, b: 2, name: 'Ada', nested: { value: 9 } };
    expect(resolveDisplayValue(row, column, 42)).toBe(42);
  });
});

describe('formatCellText', () => {
  it('calls a function format for every value, including null and undefined', () => {
    const seen: unknown[] = [];
    const column: ColumnDef = {
      id: 'x',
      format: (value) => {
        seen.push(value);
        return 'F';
      },
    };
    expect(formatCellText(null, column)).toBe('F');
    expect(formatCellText(undefined, column)).toBe('F');
    expect(formatCellText('hi', column)).toBe('F');
    expect(seen).toEqual([null, undefined, 'hi']);
  });

  it('renders null and undefined as an empty string when there is no function format', () => {
    const column: ColumnDef = { id: 'x' };
    expect(formatCellText(null, column)).toBe('');
    expect(formatCellText(undefined, column)).toBe('');
  });

  it('passes strings through unchanged', () => {
    const column: ColumnDef = { id: 'x' };
    expect(formatCellText('hello', column)).toBe('hello');
  });

  it('localizes numbers', () => {
    const column: ColumnDef = { id: 'x' };
    expect(formatCellText(1234.5, column, { locale: 'en-US' })).toBe('1,234.5');
  });

  it('localizes bigints', () => {
    const column: ColumnDef = { id: 'x' };
    expect(formatCellText(1234n, column, { locale: 'en-US' })).toBe('1,234');
  });

  it('renders a Date without a format spec via a medium date style', () => {
    const column: ColumnDef = { id: 'x' };
    const date = new Date(2024, 0, 15);
    const result = formatCellText(date, column);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe(String(date));
  });

  it('uses options.booleanLabels when supplied', () => {
    const column: ColumnDef = { id: 'x' };
    const booleanLabels = { true: 'Yes', false: 'No' };
    expect(formatCellText(true, column, { booleanLabels })).toBe('Yes');
    expect(formatCellText(false, column, { booleanLabels })).toBe('No');
  });

  it("falls back to 'true'/'false' when booleanLabels is not supplied", () => {
    const column: ColumnDef = { id: 'x' };
    expect(formatCellText(true, column)).toBe('true');
    expect(formatCellText(false, column)).toBe('false');
  });

  it('applies precision for a number spec', () => {
    const column: ColumnDef = { id: 'x', format: { type: 'number', precision: 2 } };
    expect(formatCellText(3, column, { locale: 'en-US' })).toBe('3.00');
  });

  it('defaults currency to EUR when the spec names none', () => {
    const column: ColumnDef = { id: 'x', format: { type: 'currency' } };
    expect(formatCellText(10, column, { locale: 'en-US' })).toBe('€10.00');
  });

  it('applies a named currency and precision', () => {
    const column: ColumnDef = {
      id: 'x',
      format: { type: 'currency', currency: 'USD', precision: 0 },
    };
    expect(formatCellText(10.6, column, { locale: 'en-US' })).toBe('$11');
  });

  it('applies a percent spec', () => {
    const column: ColumnDef = { id: 'x', format: { type: 'percent' } };
    expect(formatCellText(0.5, column, { locale: 'en-US' })).toBe('50%');
  });

  it('formats a date spec identically for a Date, an ISO string and an epoch number', () => {
    const column: ColumnDef = { id: 'x', format: { type: 'date' } };
    const date = new Date('2024-03-05T00:00:00Z');
    const options = { locale: 'en-US', timezone: 'UTC' };
    const expected = formatCellText(date, column, options);
    expect(expected).toBe('Mar 5, 2024');
    expect(formatCellText(date.toISOString(), column, options)).toBe(expected);
    expect(formatCellText(date.getTime(), column, options)).toBe(expected);
  });

  it('formats a datetime spec on a 24-hour cycle, with no AM/PM marker', () => {
    const column: ColumnDef = { id: 'x', format: { type: 'datetime' } };
    const date = new Date('2024-03-05T13:30:00Z');
    const result = formatCellText(date, column, { locale: 'en-US', timezone: 'UTC' });
    expect(result).not.toMatch(/am|pm/i);
    expect(result).toContain('13:30');
  });

  it('formats a time spec on a 24-hour cycle, with no AM/PM marker', () => {
    const column: ColumnDef = { id: 'x', format: { type: 'time' } };
    const date = new Date('2024-03-05T13:30:00Z');
    const result = formatCellText(date, column, { locale: 'en-US', timezone: 'UTC' });
    expect(result).not.toMatch(/am|pm/i);
    expect(result).toContain('13:30');
  });

  it('falls back to the generic path for an invalid date, instead of printing "Invalid Date"', () => {
    const column: ColumnDef = { id: 'x', format: { type: 'date' } };
    expect(formatCellText('not-a-date', column)).toBe('not-a-date');
  });

  it('falls back to the generic path for a non-numeric value under a numeric spec, instead of printing "NaN"', () => {
    const column: ColumnDef = { id: 'x', format: { type: 'number' } };
    expect(formatCellText('abc', column)).toBe('abc');
  });

  it('does not corrupt results when formatting the same value with two different locales in sequence', () => {
    const column: ColumnDef = { id: 'x' };
    const en = formatCellText(1234.5, column, { locale: 'en-US' });
    const de = formatCellText(1234.5, column, { locale: 'de-DE' });
    const enAgain = formatCellText(1234.5, column, { locale: 'en-US' });
    expect(en).toBe('1,234.5');
    expect(de).toBe('1.234,5');
    expect(enAgain).toBe(en);
  });

  it('does not corrupt results when formatting the same value with two different precisions in sequence', () => {
    const low: ColumnDef = { id: 'x', format: { type: 'number', precision: 1 } };
    const high: ColumnDef = { id: 'x', format: { type: 'number', precision: 3 } };
    const first = formatCellText(1234.5, low, { locale: 'en-US' });
    const second = formatCellText(1234.5, high, { locale: 'en-US' });
    const firstAgain = formatCellText(1234.5, low, { locale: 'en-US' });
    expect(first).toBe('1,234.5');
    expect(second).toBe('1,234.500');
    expect(firstAgain).toBe(first);
  });
});
