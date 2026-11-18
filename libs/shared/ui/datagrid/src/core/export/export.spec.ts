/**
 * §15's headless half: the normalized model, the text writers, the paged
 * fetch, adapter resolution and the spreadsheet container.
 *
 * No component here — the whole point of the model is that what an export
 * contains is decided without a view.
 */
import { buildExportTable, exportValueType, numberFormatOf } from './build-table';
import { collectExportRows, isAbortError } from './collect-rows';
import { toClipboardText, toCsvBlob, toDelimitedText } from './delimited';
import { toPrintHtml } from './print';
import { BUILT_IN_EXPORT_ADAPTERS, resolveExportAdapter, withExtension } from './run-export';
import { resolveExcelBranding } from './xlsx/branding';
import { columnRef, excelSerial, toXlsxBlob } from './xlsx/workbook';
import { crc32, zipStored } from './xlsx/zip';
import { buildGroups } from '../grouping/group-nodes';
import type { ColumnDef } from '../types/column.types';
import type { ExportAdapter, ExportTable } from '../types/export.types';

interface Row {
  id: number;
  name: string;
  branch: string;
  total: number;
  when: Date;
  active: boolean;
}

const ROWS: Row[] = [
  {
    id: 1,
    name: 'Alpha',
    branch: 'Nicosia',
    total: 12.5,
    when: new Date('2026-03-04T09:30:00Z'),
    active: true,
  },
  {
    id: 2,
    name: 'Beta, Ltd',
    branch: 'Larnaca',
    total: 7,
    when: new Date('2026-03-05T09:30:00Z'),
    active: false,
  },
  {
    id: 3,
    name: 'Gamma',
    branch: 'Nicosia',
    total: 4.25,
    when: new Date('2026-03-06T09:30:00Z'),
    active: true,
  },
];

const COLUMNS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', caption: 'Name' },
  { id: 'branch', field: 'branch', caption: 'Branch' },
  {
    id: 'total',
    field: 'total',
    caption: 'Total',
    dataType: 'number',
    format: { type: 'number', precision: 2 },
  },
];

function table(overrides: Partial<Parameters<typeof buildExportTable<Row>>[0]> = {}): ExportTable {
  return buildExportTable<Row>({
    format: 'csv',
    fileName: 'bookings',
    sheetName: 'Bookings',
    columns: COLUMNS,
    rows: ROWS,
    // Pinned, or the numbers in every assertion follow whatever locale the
    // machine running the suite happens to be set to.
    formatOptions: { locale: 'en-US' },
    ...overrides,
  });
}

function rowsOfKind(model: ExportTable, kind: string): readonly string[][] {
  return model.rows
    .filter((row) => row.kind === kind)
    .map((row) => row.cells.map((cell) => cell.text));
}

describe('export table model', () => {
  it('writes a header row and one row per record, in column order', () => {
    const model = table();
    expect(rowsOfKind(model, 'header')).toEqual([['Name', 'Branch', 'Total']]);
    expect(rowsOfKind(model, 'data')).toEqual([
      ['Alpha', 'Nicosia', '12.50'],
      ['Beta, Ltd', 'Larnaca', '7.00'],
      ['Gamma', 'Nicosia', '4.25'],
    ]);
  });

  it('keeps the underlying value beside the formatted text', () => {
    const cell = table().rows[1].cells[2];
    expect(cell.value).toBe(12.5);
    expect(cell.text).toBe('12.50');
    expect(cell.type).toBe('number');
    expect(cell.style?.numberFormat).toBe('#,##0.00');
  });

  it('renders a format function as text, because no number format reproduces it', () => {
    const model = table({
      columns: [{ id: 'total', field: 'total', format: (value) => `~${String(value)}` }],
    });
    expect(model.rows[1].cells[0].type).toBe('string');
    expect(model.rows[1].cells[0].text).toBe('~12.5');
  });

  it('omits the header and the bands on request', () => {
    const model = table({ options: { headers: false } });
    expect(model.rows.every((row) => row.kind === 'data')).toBe(true);
  });

  it('draws a band caption row above the header, spanning its columns', () => {
    const model = table({
      declaredColumns: [
        { id: 'name', field: 'name', caption: 'Name' },
        {
          id: 'where',
          caption: 'Where',
          columns: [
            { id: 'branch', field: 'branch', caption: 'Branch' },
            { id: 'total', field: 'total', caption: 'Total' },
          ],
        },
      ],
    });
    const band = model.rows[0];
    expect(band.kind).toBe('band');
    expect(band.cells.map((cell) => [cell.text, cell.colSpan])).toEqual([
      ['', 1],
      ['Where', 2],
    ]);
  });

  it('writes a group header per node, indented by level, with its count', () => {
    const groups = buildGroups(ROWS, [{ field: 'branch' }]);
    const model = table({ groups });
    const headers = model.rows.filter((row) => row.kind === 'group');
    expect(headers.map((row) => row.cells[0].text)).toEqual([
      'Branch: Larnaca (1)',
      'Branch: Nicosia (2)',
    ]);
    expect(headers[0].cells[0].colSpan).toBe(3);
    expect(headers[0].level).toBe(0);
  });

  it('leaves the groups out on request', () => {
    const groups = buildGroups(ROWS, [{ field: 'branch' }]);
    const model = table({ groups, options: { groups: false } });
    expect(model.rows.some((row) => row.kind === 'group')).toBe(false);
    expect(rowsOfKind(model, 'data')).toHaveLength(3);
  });

  it('puts a total under its own column and labels the first cell', () => {
    const model = table({
      totals: [{ field: 'total', type: 'sum', valueFormat: { type: 'number', precision: 2 } }],
      totalAggregates: { 'total:sum': 23.75 },
      totalsLabel: 'Totals',
    });
    const summary = model.rows.at(-1);
    expect(summary?.kind).toBe('summary');
    expect(summary?.cells.map((cell) => cell.text)).toEqual(['Totals', '', '23.75']);
  });

  it('takes the file name and the sheet name from the options over the input', () => {
    const model = table({ options: { fileName: 'chosen', sheetName: 'Sheet' } });
    expect(model.fileName).toBe('chosen');
    expect(model.sheetName).toBe('Sheet');
  });

  it('carries the rendered width of each column', () => {
    const model = table({ widths: new Map([['name', 220]]) });
    expect(model.columns.map((column) => column.width)).toEqual([220, 0, 0]);
  });
});

describe('export visuals in the model', () => {
  it('carries a column visual onto its data cells, read from the display value', () => {
    const seen: unknown[] = [];
    const table = buildExportTable<Row>({
      format: 'pdf',
      fileName: 'f',
      sheetName: 's',
      columns: [
        {
          id: 'branch',
          field: 'branch',
          display: (row) => row.branch.toUpperCase(),
          exportVisual: (_row, value) => {
            seen.push(value);
            return value === 'NICOSIA'
              ? { kind: 'tags', tags: [{ label: 'N', tone: 'info' }] }
              : null;
          },
        },
      ],
      rows: ROWS,
    });
    expect(seen).toEqual(['NICOSIA', 'LARNACA', 'NICOSIA']);
    const cells = table.rows.filter((row) => row.kind === 'data').map((row) => row.cells[0]);
    expect(cells[0].visual).toEqual({ kind: 'tags', tags: [{ label: 'N', tone: 'info' }] });
    expect('visual' in cells[1]).toBe(false);
    expect(table.rows[0].cells[0].visual).toBeUndefined();
  });
});

describe('export value typing', () => {
  it('reads the declared type before the runtime one', () => {
    expect(exportValueType('2026-01-01', { id: 'a', dataType: 'date' })).toBe('date');
    expect(exportValueType(5, { id: 'a' })).toBe('number');
    expect(exportValueType(true, { id: 'a' })).toBe('boolean');
    expect(exportValueType(new Date(), { id: 'a' })).toBe('datetime');
  });

  it('reports an absent value as empty rather than as a string', () => {
    expect(exportValueType(null, { id: 'a' })).toBe('empty');
    expect(exportValueType('', { id: 'a' })).toBe('empty');
  });

  it('maps a format spec to a spreadsheet number format', () => {
    expect(numberFormatOf({ type: 'number', precision: 2 })).toBe('#,##0.00');
    expect(numberFormatOf({ type: 'percent', precision: 1 })).toBe('0.0%');
    expect(numberFormatOf({ type: 'date' })).toBe('yyyy-mm-dd');
    expect(numberFormatOf((value) => String(value))).toBeUndefined();
  });

  it('takes the currency symbol and its side from Intl', () => {
    const format = numberFormatOf({ type: 'currency', currency: 'EUR' }, 'en-US');
    expect(format).toBe('"€"#,##0.00');
    expect(numberFormatOf({ type: 'currency', currency: 'EUR' }, 'el-GR')).toBe('#,##0.00 "€"');
  });
});

describe('delimited text', () => {
  it('quotes only a field that needs it', () => {
    const text = toDelimitedText(table(), { newline: '\n' });
    expect(text.split('\n')[1]).toBe('Alpha,Nicosia,12.50');
    expect(text.split('\n')[2]).toBe('"Beta, Ltd",Larnaca,7.00');
  });

  it('does not quote a comma when the delimiter is a tab', () => {
    const text = toDelimitedText(table(), { delimiter: '\t', newline: '\n' });
    expect(text.split('\n')[2]).toBe('Beta, Ltd\tLarnaca\t7.00');
  });

  it('doubles an embedded quote', () => {
    const model = table({
      columns: [{ id: 'name', field: 'name' }],
      rows: [{ ...ROWS[0], name: 'A "B"' }],
    });
    expect(toDelimitedText(model, { newline: '\n' }).split('\n')[1]).toBe('"A ""B"""');
  });

  it('pads a spanning cell to the width of the table', () => {
    const groups = buildGroups(ROWS, [{ field: 'branch' }]);
    const lines = toDelimitedText(table({ groups }), { newline: '\n' }).split('\n');
    expect(lines).toContain('Branch: Larnaca (1),,');
  });

  it('indents a nested group row in the text as it is indented on screen', () => {
    const groups = buildGroups(ROWS, [{ field: 'branch' }, { field: 'total' }]);
    const lines = toDelimitedText(table({ groups }), { newline: '\n' }).split('\n');
    expect(lines[2]).toBe('  Total: 7.00 (1),,');
  });

  it('writes a byte-order mark into a CSV file so a spreadsheet reads UTF-8', async () => {
    // Read as bytes: `Blob.text()` UTF-8 decodes, and that algorithm strips a
    // leading mark, so it can never see the thing under test.
    const bytes = new Uint8Array(await toCsvBlob(table()).arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('copies as tab-separated text with no mark and LF endings', () => {
    const text = toClipboardText(table());
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text).toContain('\t');
    expect(text).not.toContain('\r');
  });
});

describe('full-dataset fetch', () => {
  function pagedLoad(total: number, pageSize: number, calls: number[] = []) {
    return async (skip: number, take: number) => {
      calls.push(skip);
      const rows = Array.from(
        { length: Math.max(0, Math.min(take, total - skip)) },
        (_, index) => ({
          id: skip + index,
        }),
      );
      await Promise.resolve();
      return { rows, totalCount: total };
    };
  }

  it('pages until the source runs short', async () => {
    const calls: number[] = [];
    const rows = await collectExportRows({ load: pagedLoad(250, 100, calls), pageSize: 100 });
    expect(rows).toHaveLength(250);
    expect(calls).toEqual([0, 100, 200]);
  });

  it('stops on the reported total even when the last page is full', async () => {
    const calls: number[] = [];
    const rows = await collectExportRows({ load: pagedLoad(200, 100, calls), pageSize: 100 });
    expect(rows).toHaveLength(200);
    expect(calls).toEqual([0, 100]);
  });

  it('reports progress after every page', async () => {
    const seen: [number, number | undefined][] = [];
    await collectExportRows({
      load: pagedLoad(250, 100),
      pageSize: 100,
      onProgress: (loaded, total) => seen.push([loaded, total]),
    });
    expect(seen).toEqual([
      [100, 250],
      [200, 250],
      [250, 250],
    ]);
  });

  it('stops at the row cap rather than paging a source that never ends', async () => {
    const rows = await collectExportRows({
      load: async (skip, take) => {
        await Promise.resolve();
        return { rows: Array.from({ length: take }, (_, index) => ({ id: skip + index })) };
      },
      pageSize: 100,
      maxRows: 250,
    });
    expect(rows).toHaveLength(250);
  });

  it('aborts between pages and reports it as a cancellation', async () => {
    const controller = new AbortController();
    const promise = collectExportRows({
      load: async (skip, take) => {
        controller.abort();
        await Promise.resolve();
        return { rows: Array.from({ length: take }, (_, index) => ({ id: skip + index })) };
      },
      pageSize: 10,
      signal: controller.signal,
    });
    await expect(promise).rejects.toSatisfy(isAbortError);
  });
});

describe('adapter resolution', () => {
  const custom: ExportAdapter = {
    format: 'CSV',
    extension: 'txt',
    mimeType: 'text/plain',
    write: () => new Blob(),
  };

  it('offers csv and tsv without any registration', () => {
    expect(BUILT_IN_EXPORT_ADAPTERS.map((adapter) => adapter.format)).toEqual(['csv', 'tsv']);
    expect(resolveExportAdapter('csv', [])?.extension).toBe('csv');
  });

  it('lets a host registration replace a built-in of the same name', () => {
    expect(resolveExportAdapter('csv', [custom])).toBe(custom);
  });

  it('takes the last registration when a format is registered twice', () => {
    const later: ExportAdapter = { ...custom, extension: 'later' };
    expect(resolveExportAdapter('csv', [custom, later])).toBe(later);
  });

  it('answers null for a format nothing writes', () => {
    expect(resolveExportAdapter('xlsx', [])).toBeNull();
  });

  it('appends the extension unless the name already carries it', () => {
    expect(withExtension('bookings', 'csv')).toBe('bookings.csv');
    expect(withExtension('bookings.csv', 'csv')).toBe('bookings.csv');
    expect(withExtension('  ', 'csv')).toBe('export.csv');
  });
});

describe('print document', () => {
  it('puts the header rows in a thead and the data in a tbody', () => {
    const html = toPrintHtml(table(), { title: 'Bookings' });
    expect(html).toContain('<thead><tr data-kind="header"><th');
    expect(html).toContain('<tbody><tr data-kind="data"><td');
  });

  it('escapes markup in a cell', () => {
    const model = table({
      columns: [{ id: 'name', field: 'name' }],
      rows: [{ ...ROWS[0], name: '<b>x</b>' }],
    });
    expect(toPrintHtml(model, { title: 't' })).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('spreadsheet container', () => {
  it('computes the CRC of the ZIP specification example', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes a readable archive: local headers, a directory and an end record', () => {
    const bytes = zipStored([{ path: 'a.txt', data: new TextEncoder().encode('hello') }]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(1);
  });

  it('names columns past Z', () => {
    expect(columnRef(0)).toBe('A');
    expect(columnRef(25)).toBe('Z');
    expect(columnRef(26)).toBe('AA');
    expect(columnRef(27)).toBe('AB');
  });

  it('turns a date into a spreadsheet serial in the declared timezone', () => {
    // 1970-01-01 is serial 25569, and the epoch is the anchor every reader shares.
    expect(excelSerial(new Date('1970-01-01T00:00:00Z'), 'UTC')).toBe(25569);
    expect(excelSerial(new Date('2026-03-04T12:00:00Z'), 'UTC')).toBeCloseTo(46085.5, 5);
  });

  it('produces a workbook whose parts are all present', async () => {
    const blob = toXlsxBlob(table());
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    for (const part of [
      '[Content_Types].xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
      'xl/styles.xml',
    ]) {
      expect(text).toContain(part);
    }
    expect(blob.type).toContain('spreadsheetml');
  });

  it('writes a number as a number and a string inline', async () => {
    const text = new TextDecoder().decode(new Uint8Array(await toXlsxBlob(table()).arrayBuffer()));
    expect(text).toContain('<v>12.5</v>');
    expect(text).toContain('t="inlineStr"');
  });

  it('merges a band caption across the columns it covers', async () => {
    const model = table({
      declaredColumns: [
        { id: 'name', field: 'name', caption: 'Name' },
        {
          id: 'where',
          caption: 'Where',
          columns: [
            { id: 'branch', field: 'branch', caption: 'Branch' },
            { id: 'total', field: 'total', caption: 'Total' },
          ],
        },
      ],
    });
    const text = new TextDecoder().decode(new Uint8Array(await toXlsxBlob(model).arrayBuffer()));
    expect(text).toContain('<mergeCell ref="B1:C1"/>');
  });

  it('replaces characters a sheet name may not carry', async () => {
    const model = table({ sheetName: 'A/B:C*D' });
    const text = new TextDecoder().decode(new Uint8Array(await toXlsxBlob(model).arrayBuffer()));
    expect(text).toContain('name="A B C D"');
  });
});

describe('spreadsheet branding', () => {
  const BRANDING = {
    subtitle: 'Koureia',
    accent: '#9E5F28',
    band: '#FBF8F2',
    muted: '#7A6E5F',
  };

  async function sheetOf(branding: Record<string, unknown>, model = table()): Promise<string> {
    const bytes = new Uint8Array(await toXlsxBlob(model, { branding }).arrayBuffer());
    return new TextDecoder().decode(bytes);
  }

  it('opens with a banner titled after the sheet, and a subtitle under it', async () => {
    const text = await sheetOf(BRANDING);
    expect(text).toContain('<t xml:space="preserve">Bookings</t>');
    expect(text).toContain('<t xml:space="preserve">Koureia</t>');
    // Both lines span the table, and the gap row keeps the banner off the header.
    expect(text).toContain('<mergeCell ref="A1:C1"/>');
    expect(text).toContain('<mergeCell ref="A2:C2"/>');
    expect(text).toContain('<row r="3" ht="6" customHeight="1"/>');
  });

  it('moves the table below the banner and freezes the header with it', async () => {
    const text = await sheetOf(BRANDING);
    // The header is row 4: two banner lines, the gap, then the table.
    expect(text).toContain('<c r="A4" s="3" t="inlineStr"><is><t xml:space="preserve">Name</t>');
    expect(text).toContain('<pane ySplit="4" topLeftCell="A5"');
  });

  it('leaves the sheet as it was without branding', async () => {
    const text = new TextDecoder().decode(new Uint8Array(await toXlsxBlob(table()).arrayBuffer()));
    expect(text).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Name</t>');
    expect(text).not.toContain('customHeight');
  });

  it('fills the header with the accent and leaves the data cells alone', async () => {
    const text = await sheetOf(BRANDING);
    const styles = text.slice(text.indexOf('<styleSheet'), text.indexOf('</styleSheet>'));
    expect(styles).toContain('<fgColor rgb="FF9E5F28"/>');
    // The header font is the white bold one; a data cell carries no style at all.
    expect(styles).toContain(
      '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/>',
    );
    expect(text).toContain('<c r="A5" t="inlineStr"><is><t xml:space="preserve">Alpha</t>');
  });

  it('embeds a logo as a drawing anchored to the last column', async () => {
    const branded = {
      ...BRANDING,
      logo: { png: new Uint8Array([1, 2, 3]), width: 26, height: 26 },
    };
    const text = await sheetOf(branded);
    expect(text).toContain('xl/drawings/drawing1.xml');
    expect(text).toContain('xl/drawings/_rels/drawing1.xml.rels');
    expect(text).toContain('xl/media/image1.png');
    expect(text).toContain('<Default Extension="png" ContentType="image/png"/>');
    expect(text).toContain('<drawing r:id="rId1"/>');
    // Three columns, so the mark hangs off the third.
    expect(text).toContain('<xdr:col>2</xdr:col>');
  });

  it('drops a logo that fails to load rather than failing the export', async () => {
    const fetchStub = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchStub);

    const resolved = await resolveExcelBranding({ ...BRANDING, logo: { url: '/brand/icon.png' } });

    expect(fetchStub).toHaveBeenCalledWith('/brand/icon.png');
    expect(resolved.logo).toBeUndefined();
    expect(resolved.accent).toBe('#9E5F28');
    vi.unstubAllGlobals();
  });

  it('reads a logo at the size the branding asked for', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(3)) }),
    );

    const resolved = await resolveExcelBranding({ logo: { url: '/brand/icon.png', width: 40 } });

    expect(resolved.logo?.png.length).toBe(3);
    expect(resolved.logo?.width).toBe(40);
    // Height falls back to the default rather than to the width.
    expect(resolved.logo?.height).toBe(28);
    vi.unstubAllGlobals();
  });
});
