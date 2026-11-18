/**
 * The spreadsheet adapter: an {@link ExportTable} as an `.xlsx` workbook.
 *
 * Written here rather than taken from a package, because the whole of what a
 * grid export needs — one sheet, typed cells, number formats, merges, column
 * widths and a frozen header — is a small fraction of what a spreadsheet
 * library carries, and this module is only ever reached through `import()`.
 *
 * Values stay typed: a number arrives as a number with a format, a date as a
 * serial with a date format. A recipient can sort and total the file, which is
 * the whole reason to export a spreadsheet rather than a CSV.
 */
import { zipStored } from './zip';
import type { ZipEntry } from './zip.types';
import type { ExportCell, ExportCellStyle, ExportRow, ExportTable } from '../../types/export.types';
import type { XlsxBranding, XlsxLogo, XlsxOptions, StyleTable } from './workbook.types';

/** Days between the spreadsheet epoch (1899-12-30) and the Unix epoch. */
const EPOCH_OFFSET = 25569;

/** The first custom number-format id. Everything below is built into the format. */
const FIRST_CUSTOM_FORMAT = 164;

const DEFAULT_FORMATS: Readonly<Record<string, string>> = {
  date: 'yyyy-mm-dd',
  datetime: 'yyyy-mm-dd hh:mm',
  time: 'hh:mm',
};

/** Approximate pixels per character at the default font, for column widths. */
const PIXELS_PER_CHAR = 7;

/** Point size of the body font. */
const DEFAULT_FONT_SIZE = 11;

/** Point size of the banner title. */
const TITLE_FONT_SIZE = 14;

/** Point size of the banner subtitle. */
const SUBTITLE_FONT_SIZE = 9;

/** Width a column falls back to when the grid measured none, in pixels. */
const DEFAULT_COLUMN_WIDTH = 12 * PIXELS_PER_CHAR;

/** English Metric Units per pixel. A drawing states its offsets and size in EMU. */
const EMU_PER_PIXEL = 9525;

/** Banner geometry. A row height is in points, a drawing offset in pixels. */
const BANNER = {
  titleHeight: 26,
  subtitleHeight: 15,
  /** The empty row between the banner and the header, so the two do not touch. */
  gapHeight: 6,
  /** Space kept between the logo and the right edge of the table. */
  logoGutter: 6,
  logoTop: 4,
} as const;

/**
 * Escapes one string for XML.
 *
 * One pass rather than a chain of `replace` calls, because it also has to drop
 * what XML 1.0 cannot represent at all: a control character below `0x20` is
 * not expressible even as an entity, so an escaped one still fails to parse.
 * Tab, newline and carriage return are the three that are legal.
 */
function escapeXml(text: string): string {
  let escaped = '';
  for (const char of text) {
    switch (char) {
      case '&':
        escaped += '&amp;';
        break;
      case '<':
        escaped += '&lt;';
        break;
      case '>':
        escaped += '&gt;';
        break;
      case '"':
        escaped += '&quot;';
        break;
      default: {
        const code = char.codePointAt(0) ?? 0;
        if (code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
          escaped += char;
        }
      }
    }
  }
  return escaped;
}

/** Spreadsheet column reference: `A`, `B`, … `AA`. `index` is 0-based. */
export function columnRef(index: number): string {
  let ref = '';
  let remaining = index;
  while (remaining >= 0) {
    ref = String.fromCharCode(65 + (remaining % 26)) + ref;
    remaining = Math.floor(remaining / 26) - 1;
  }
  return ref;
}

/**
 * The spreadsheet serial of a date, read in the given timezone.
 *
 * A serial is a bare number with no zone, so it has to be built from the wall
 * clock the grid showed. Reading the parts back through `Intl` is what makes
 * an export from a grid pinned to `Europe/Nicosia` agree with the cells on
 * screen, whatever the machine running the browser is set to.
 */
export function excelSerial(date: Date, timezone?: string): number {
  if (timezone == null) {
    const local = Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    );
    return local / 86_400_000 + EPOCH_OFFSET;
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const utc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return utc / 86_400_000 + EPOCH_OFFSET;
}

function createStyleTable(): StyleTable {
  const formats: string[] = [];
  const fonts: string[] = [`0|0||${DEFAULT_FONT_SIZE.toString()}`];
  const fills: string[] = [];
  const records: string[] = ['0|-1|0||0'];
  const seen = new Map<string, number>([['0|-1|0||0', 0]]);

  const register = (list: string[], value: string): number => {
    const found = list.indexOf(value);
    if (found >= 0) {
      return found;
    }
    list.push(value);
    return list.length - 1;
  };

  return {
    formats,
    fonts,
    fills,
    records,
    indexOf(style, numberFormat) {
      const format = style?.numberFormat ?? numberFormat;
      const fontKey = `${style?.bold === true ? 1 : 0}|${style?.italic === true ? 1 : 0}|${style?.color ?? ''}|${(style?.fontSize ?? DEFAULT_FONT_SIZE).toString()}`;
      const fontIndex = register(fonts, fontKey);
      const fillIndex = style?.fill == null ? -1 : register(fills, style.fill);
      const formatId = format == null ? 0 : FIRST_CUSTOM_FORMAT + register(formats, format);
      const key = `${fontIndex.toString()}|${fillIndex.toString()}|${formatId.toString()}|${style?.align ?? ''}|${style?.wrap === true ? 1 : 0}`;
      const existing = seen.get(key);
      if (existing !== undefined) {
        return existing;
      }
      records.push(key);
      const index = records.length - 1;
      seen.set(key, index);
      return index;
    },
  };
}

function fontXml(key: string): string {
  const [bold, italic, color, size] = key.split('|');
  const parts = [`<sz val="${size}"/>`, '<name val="Calibri"/>'];
  if (bold === '1') {
    parts.unshift('<b/>');
  }
  if (italic === '1') {
    parts.unshift('<i/>');
  }
  if (color !== '') {
    parts.push(`<color rgb="FF${color.replace('#', '').toUpperCase()}"/>`);
  }
  return `<font>${parts.join('')}</font>`;
}

function fillXml(color: string): string {
  const rgb = `FF${color.replace('#', '').toUpperCase()}`;
  return `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
}

const ALIGNMENT: Readonly<Record<string, string>> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

function stylesXml(table: StyleTable): string {
  const numFmts = table.formats
    .map(
      (format, index) =>
        `<numFmt numFmtId="${(FIRST_CUSTOM_FORMAT + index).toString()}" formatCode="${escapeXml(format)}"/>`,
    )
    .join('');
  const fonts = table.fonts.map(fontXml).join('');
  // The first two fills are reserved: a reader rejects a workbook whose fill 0
  // is not `none` and whose fill 1 is not `gray125`.
  const fills = `<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${table.fills.map(fillXml).join('')}`;
  const xfs = table.records
    .map((record) => {
      const [fontIndex, fillIndex, formatId, align, wrap] = record.split('|');
      const fill = Number(fillIndex) < 0 ? 0 : Number(fillIndex) + 2;
      const alignment =
        align === '' && wrap === '0'
          ? ''
          : `<alignment${align === '' ? '' : ` horizontal="${ALIGNMENT[align] ?? 'left'}"`}${wrap === '1' ? ' wrapText="1"' : ''}/>`;
      const applyAlignment = alignment === '' ? '' : ' applyAlignment="1"';
      return `<xf numFmtId="${formatId}" fontId="${fontIndex}" fillId="${fill.toString()}" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"${applyAlignment}>${alignment}</xf>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${table.formats.length.toString()}">${numFmts}</numFmts><fonts count="${table.fonts.length.toString()}">${fonts}</fonts><fills count="${(table.fills.length + 2).toString()}">${fills}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${table.records.length.toString()}">${xfs}</cellXfs></styleSheet>`;
}

/** One cell's XML, its column position, and how many columns it covers. */
function cellXml(
  cell: ExportCell,
  ref: string,
  styleIndex: number,
  timezone: string | undefined,
): string {
  const style = styleIndex === 0 ? '' : ` s="${styleIndex.toString()}"`;
  const indent = cell.indent > 0 ? '  '.repeat(cell.indent) : '';
  switch (cell.type) {
    case 'empty':
      return cell.text === '' ? '' : inlineString(ref, style, indent + cell.text);
    case 'number': {
      const numeric = Number(cell.value);
      return Number.isFinite(numeric)
        ? `<c r="${ref}"${style}><v>${numeric.toString()}</v></c>`
        : inlineString(ref, style, indent + cell.text);
    }
    case 'boolean':
      return `<c r="${ref}"${style} t="b"><v>${cell.value === true ? '1' : '0'}</v></c>`;
    case 'date':
    case 'datetime':
    case 'time': {
      const date = toDate(cell.value);
      return date == null
        ? inlineString(ref, style, indent + cell.text)
        : `<c r="${ref}"${style}><v>${excelSerial(date, timezone).toString()}</v></c>`;
    }
    default:
      return inlineString(ref, style, indent + cell.text);
  }
}

function inlineString(ref: string, style: string, text: string): string {
  // `xml:space="preserve"` keeps a group row's leading indent, which a reader
  // would otherwise collapse away.
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** Header rows at the top of the table, which the frozen pane sits below. */
function headerRowCount(table: ExportTable): number {
  let count = 0;
  for (const row of table.rows) {
    if (row.kind !== 'band' && row.kind !== 'header') {
      break;
    }
    count += 1;
  }
  return count;
}

/**
 * The brand dressing one row kind takes.
 *
 * Only the rows a reader already reads as chrome: the header band and the total
 * row. Data cells keep the styling the table gave them, so a recipient sees the
 * numbers and not the theme.
 */
function brandRowStyle(kind: ExportRow['kind'], branding: XlsxBranding): ExportCellStyle | null {
  if (kind === 'header' || kind === 'band') {
    return branding.accent == null
      ? null
      : { bold: true, fill: branding.accent, color: branding.onAccent ?? '#FFFFFF' };
  }
  if (kind === 'summary') {
    return branding.band == null ? null : { bold: true, fill: branding.band };
  }
  return null;
}

/**
 * The banner above the table: a title, an optional subtitle, and a gap row.
 *
 * Each line is one merged range, and the cells the range covers are written as
 * empty siblings. A reader paints the range from its anchor, but a range whose
 * covered cells are absent loses the fill in some of them.
 */
function bannerXml(
  table: ExportTable,
  styles: StyleTable,
  branding: XlsxBranding,
): { rows: string; merges: string[]; count: number } {
  const empty = { rows: '', merges: [], count: 0 };
  const span = table.columns.length;
  if (span === 0) {
    return empty;
  }
  const title = branding.title ?? table.sheetName;
  const band = branding.band == null ? {} : { fill: branding.band };
  const lines: { text: string; height: number; style: ExportCellStyle }[] = [];
  if (title !== '') {
    lines.push({
      text: title,
      height: BANNER.titleHeight,
      style: {
        bold: true,
        fontSize: TITLE_FONT_SIZE,
        ...(branding.accent == null ? {} : { color: branding.accent }),
        ...band,
      },
    });
  }
  if (branding.subtitle != null && branding.subtitle !== '') {
    lines.push({
      text: branding.subtitle,
      height: BANNER.subtitleHeight,
      style: {
        fontSize: SUBTITLE_FONT_SIZE,
        ...(branding.muted == null ? {} : { color: branding.muted }),
        ...band,
      },
    });
  }
  if (lines.length === 0) {
    return empty;
  }

  const rows = lines.map((line, index) => {
    const number = (index + 1).toString();
    const styleIndex = styles.indexOf(line.style, undefined);
    const style = ` s="${styleIndex.toString()}"`;
    const cells = [inlineString(`A${number}`, style, line.text)];
    for (let column = 1; column < span; column += 1) {
      cells.push(`<c r="${columnRef(column)}${number}"${style}/>`);
    }
    return `<row r="${number}" ht="${line.height.toString()}" customHeight="1">${cells.join('')}</row>`;
  });
  const merges =
    span === 1
      ? []
      : lines.map((_, index) => {
          const number = (index + 1).toString();
          return `<mergeCell ref="A${number}:${columnRef(span - 1)}${number}"/>`;
        });
  const gap = (lines.length + 1).toString();
  rows.push(`<row r="${gap}" ht="${BANNER.gapHeight.toString()}" customHeight="1"/>`);
  return { rows: rows.join(''), merges, count: lines.length + 1 };
}

/**
 * The logo, anchored to the right edge of the banner.
 *
 * A one-cell anchor keeps the drawn size whatever the recipient does to the
 * columns, and the offset right-aligns the mark inside the last column, so it
 * sits opposite the title rather than over it.
 */
function drawingXml(table: ExportTable, logo: XlsxLogo): string {
  const lastIndex = Math.max(0, table.columns.length - 1);
  const measured = table.columns[lastIndex]?.width ?? 0;
  const columnWidth = measured > 0 ? measured : DEFAULT_COLUMN_WIDTH;
  const emu = (pixels: number): string => Math.round(pixels * EMU_PER_PIXEL).toString();
  const offsetX = Math.max(0, columnWidth - logo.width - BANNER.logoGutter);
  const size = `cx="${emu(logo.width)}" cy="${emu(logo.height)}"`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>${lastIndex.toString()}</xdr:col><xdr:colOff>${emu(offsetX)}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${emu(BANNER.logoTop)}</xdr:rowOff></xdr:from><xdr:ext ${size}/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo" descr="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext ${size}/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}

function sheetXml(table: ExportTable, styles: StyleTable, options: XlsxOptions): string {
  const branding = options.branding;
  const banner =
    branding == null
      ? { rows: '', merges: [] as string[], count: 0 }
      : bannerXml(table, styles, branding);
  const merges: string[] = [...banner.merges];
  const rows: string[] = banner.rows === '' ? [] : [banner.rows];

  table.rows.forEach((row, rowIndex) => {
    const number = rowIndex + 1 + banner.count;
    const rowStyle = branding == null ? null : brandRowStyle(row.kind, branding);
    const cells: string[] = [];
    let column = 0;
    for (const cell of row.cells) {
      const ref = `${columnRef(column)}${number.toString()}`;
      const numberFormat = DEFAULT_FORMATS[cell.type];
      // The brand's dressing wins over the cell's own, so a header keeps its
      // alignment and its number format and takes the brand's fill.
      const style = rowStyle == null ? cell.style : { ...cell.style, ...rowStyle };
      const xml = cellXml(cell, ref, styles.indexOf(style, numberFormat), options.timezone);
      if (xml !== '') {
        cells.push(xml);
      }
      if (cell.colSpan > 1) {
        merges.push(
          `<mergeCell ref="${ref}:${columnRef(column + cell.colSpan - 1)}${number.toString()}"/>`,
        );
      }
      column += cell.colSpan;
    }
    rows.push(`<row r="${number.toString()}">${cells.join('')}</row>`);
  });

  const cols = table.columns
    .map((column, index) => {
      const width =
        column.width > 0 ? Math.round((column.width / PIXELS_PER_CHAR) * 100) / 100 : 12;
      const position = (index + 1).toString();
      return `<col min="${position}" max="${position}" width="${width.toString()}" customWidth="1"/>`;
    })
    .join('');

  const frozen = options.freezeHeader === false ? 0 : headerRowCount(table) + banner.count;
  const pane =
    frozen === 0
      ? ''
      : `<pane ySplit="${frozen.toString()}" topLeftCell="A${(frozen + 1).toString()}" activePane="bottomLeft" state="frozen"/>`;
  const mergeXml =
    merges.length === 0
      ? ''
      : `<mergeCells count="${merges.length.toString()}">${merges.join('')}</mergeCells>`;
  // The schema fixes the order: `drawing` comes after `mergeCells`.
  const drawing = branding?.logo == null ? '' : '<drawing r:id="rId1"/>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>${table.columns.length === 0 ? '' : `<cols>${cols}</cols>`}<sheetData>${rows.join('')}</sheetData>${mergeXml}${drawing}</worksheet>`;
}

/** A sheet name a reader accepts: 31 characters, none of `[]:*?/\`. */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim();
  return cleaned === '' ? 'Sheet1' : cleaned.slice(0, 31);
}

/** Renders the table as an `.xlsx` workbook. */
export function toXlsxBlob(
  table: ExportTable,
  options: Readonly<Record<string, unknown>> = {},
): Blob {
  const branding = options['branding'];
  const settings: XlsxOptions = {
    freezeHeader: options['freezeHeader'] !== false,
    ...(typeof options['timezone'] === 'string' ? { timezone: options['timezone'] } : {}),
    ...(typeof branding === 'object' && branding !== null ? { branding } : {}),
  };
  const styles = createStyleTable();
  // The sheet is rendered first: laying the cells out is what registers every
  // style, and `styles.xml` has to carry the finished table.
  const sheet = sheetXml(table, styles, settings);
  const sheetName = escapeXml(safeSheetName(table.sheetName));

  const encoder = new TextEncoder();
  const file = (path: string, text: string): ZipEntry => ({ path, data: encoder.encode(text) });

  const logo = settings.branding?.logo;
  const logoTypes =
    logo == null
      ? ''
      : '<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';

  const entries: ZipEntry[] = [
    file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${logoTypes}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    file(
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    file(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    file('xl/styles.xml', stylesXml(styles)),
    file('xl/worksheets/sheet1.xml', sheet),
  ];

  if (logo != null) {
    entries.push(
      file(
        'xl/worksheets/_rels/sheet1.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
      ),
      file('xl/drawings/drawing1.xml', drawingXml(table, logo)),
      file(
        'xl/drawings/_rels/drawing1.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>',
      ),
      { path: 'xl/media/image1.png', data: logo.png },
    );
  }

  const bytes = zipStored(entries);
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
