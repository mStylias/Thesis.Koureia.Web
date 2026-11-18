/**
 * The PDF writer (§15).
 *
 * Draws the export model as the grid draws it: the visible columns at their
 * relative widths, the header on every page, group and total rows, and each
 * preset's visual (tags, checks, links). Text wraps instead of truncating, so
 * no value is lost to a narrow column.
 *
 * Reached only through `import()`, so jsPDF loads with the first PDF export.
 */
import { jsPDF } from 'jspdf';
import { autoTable, type CellDef, type CellHookData, type Styles } from 'jspdf-autotable';
import type { DatagridPdfOptions } from '../export-adapters.types';
import type {
  ExportCell,
  ExportCellVisual,
  ExportRow,
  ExportTable,
  ExportTag,
} from '../../types/export.types';
import type {
  PdfColor,
  PdfFaces,
  PdfFontFiles,
  PdfPalette,
  PdfResources,
  PlacedTag,
} from './pdf-document.types';

/** Points per CSS pixel. */
const PT_PER_PX = 0.75;
const MARGIN = 28;
const FONT_SIZE = 8.5;
const TITLE_SIZE = 13;
const SUBTITLE_SIZE = 8.5;
const FOOTER_SIZE = 7.5;
const CELL_PADDING = { top: 5, right: 6, bottom: 5, left: 6 };
/** Inset per group level, as the grid indents a nested group. */
const INDENT = 10;
/** Width a column without a measured width gets, in pixels. */
const DEFAULT_COLUMN_WIDTH = 120;
const HAIRLINE = 0.5;

const TAG = { fontSize: 7.5, height: 12, padX: 5, gap: 3, lineGap: 3 } as const;
const CHECK_SIZE = 7;

const FAMILY = 'GridSans';

export function toPdfBlob(
  table: ExportTable,
  resources: PdfResources,
  options: DatagridPdfOptions,
): Blob {
  const widthsPx = table.columns.map((column) =>
    column.width > 0 ? column.width : DEFAULT_COLUMN_WIDTH,
  );
  const totalPt = widthsPx.reduce((sum, width) => sum + width, 0) * PT_PER_PX;
  const pageSize = options.pageSize ?? 'a4';
  const doc = new jsPDF({
    orientation: orientationFor(options.orientation, totalPt, pageSize),
    unit: 'pt',
    format: pageSize,
    compress: true,
  });
  const title = options.title ?? table.sheetName;
  doc.setProperties({ title });
  const faces = registerFaces(doc, resources.fonts);
  const palette = resources.palette;

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;
  // The grid fills its width, so the page does too: every column keeps its share.
  const scale = totalPt > 0 ? contentWidth / totalPt : 1;
  const widths = widthsPx.map((width) => width * PT_PER_PX * scale);

  const bannerBottom = drawBanner(doc, faces, palette, resources, title, options.subtitle);

  const { head, body } = splitRows(table.rows);
  const exported = new WeakMap<object, ExportCell>();
  const toRow = (row: ExportRow): CellDef[] =>
    row.cells.map((cell) => {
      const def: CellDef = {
        content: contentOf(cell),
        colSpan: cell.colSpan,
        styles: cellStyles(row, cell, palette),
      };
      exported.set(def, cell);
      return def;
    });

  autoTable(doc, {
    theme: 'plain',
    startY: bannerBottom,
    margin: { top: MARGIN, right: MARGIN, bottom: MARGIN + FOOTER_SIZE + 6, left: MARGIN },
    head: head.map(toRow),
    body: body.map(toRow),
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    tableWidth: contentWidth,
    columnStyles: Object.fromEntries(widths.map((width, index) => [index, { cellWidth: width }])),
    styles: {
      font: faces.family,
      fontStyle: 'normal',
      fontSize: FONT_SIZE,
      textColor: palette.text,
      fillColor: palette.surface,
      lineColor: palette.borderSubtle,
      lineWidth: { bottom: HAIRLINE },
      cellPadding: CELL_PADDING,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fontStyle: 'bold',
      textColor: palette.textSecondary,
      fillColor: palette.header,
      lineColor: palette.border,
    },
    didParseCell: (data) => {
      const cell = exportedCell(exported, data);
      if (cell?.visual?.kind === 'tags') {
        const width = spanWidth(widths, data.column.index, cell.colSpan) - padX(cell);
        const lines = layoutTags(doc, faces, cell.visual.tags, width).length;
        data.cell.styles.minCellHeight =
          lines * TAG.height + (lines - 1) * TAG.lineGap + CELL_PADDING.top + CELL_PADDING.bottom;
      }
    },
    didDrawCell: (data) => {
      const cell = exportedCell(exported, data);
      if (cell?.visual != null) {
        drawVisual(doc, faces, palette, resources.baseUrl, data, cell, cell.visual);
      }
    },
  });

  drawFooters(doc, faces, palette, title);
  return doc.output('blob');
}

function orientationFor(
  requested: DatagridPdfOptions['orientation'],
  tableWidth: number,
  pageSize: 'a4' | 'letter',
): 'portrait' | 'landscape' {
  if (requested === 'portrait' || requested === 'landscape') {
    return requested;
  }
  const portraitWidth = pageSize === 'letter' ? 612 : 595.28;
  return tableWidth > portraitWidth - MARGIN * 2 ? 'landscape' : 'portrait';
}

/** Registers the faces. A missing medium or bold face reuses the regular file. */
function registerFaces(doc: jsPDF, fonts: PdfFontFiles | null): PdfFaces {
  if (fonts == null) {
    return { family: 'helvetica', medium: 'bold' };
  }
  const add = (file: string, name: string, style: string): void => {
    doc.addFileToVFS(name, file);
    doc.addFont(name, FAMILY, style);
  };
  add(fonts.regular, 'grid-regular.ttf', 'normal');
  add(fonts.bold ?? fonts.regular, 'grid-bold.ttf', 'bold');
  add(fonts.medium ?? fonts.regular, 'grid-medium.ttf', 'medium');
  return { family: FAMILY, medium: 'medium' };
}

/** Logo, title and subtitle above the table. Returns where the table starts. */
function drawBanner(
  doc: jsPDF,
  faces: PdfFaces,
  palette: PdfPalette,
  resources: PdfResources,
  title: string,
  subtitle: string | undefined,
): number {
  let x = MARGIN;
  let height = 0;
  const logo = resources.logo;
  if (logo != null) {
    const width = logo.width * PT_PER_PX;
    const logoHeight = logo.height * PT_PER_PX;
    doc.addImage(logo.bytes, logo.format, x, MARGIN, width, logoHeight);
    x += width + 8;
    height = logoHeight;
  }
  const textHeight = TITLE_SIZE + (subtitle ? SUBTITLE_SIZE + 3 : 0);
  let y = MARGIN + Math.max(0, (height - textHeight) / 2);
  if (title !== '') {
    doc.setFont(faces.family, 'bold');
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(...palette.text);
    doc.text(title, x, y, { baseline: 'top' });
    y += TITLE_SIZE + 3;
  }
  if (subtitle) {
    doc.setFont(faces.family, 'normal');
    doc.setFontSize(SUBTITLE_SIZE);
    doc.setTextColor(...palette.textMuted);
    doc.text(subtitle, x, y, { baseline: 'top' });
  }
  height = Math.max(height, textHeight);
  if (height === 0) {
    return MARGIN;
  }
  const rule = MARGIN + height + 8;
  doc.setDrawColor(...palette.accent);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, rule, doc.internal.pageSize.getWidth() - MARGIN, rule);
  return rule + 10;
}

/** The title and `page / pages` at the foot of every page. */
function drawFooters(doc: jsPDF, faces: PdfFaces, palette: PdfPalette, title: string): void {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const y = doc.internal.pageSize.getHeight() - MARGIN + 6;
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont(faces.family, 'normal');
    doc.setFontSize(FOOTER_SIZE);
    doc.setTextColor(...palette.textMuted);
    doc.text(title, MARGIN, y, { baseline: 'bottom' });
    doc.text(`${page.toString()} / ${pages.toString()}`, width - MARGIN, y, {
      baseline: 'bottom',
      align: 'right',
    });
  }
}

/** The leading band and header rows repeat on every page. The rest is the body. */
function splitRows(rows: readonly ExportRow[]): { head: ExportRow[]; body: ExportRow[] } {
  let split = 0;
  while (split < rows.length && (rows[split].kind === 'band' || rows[split].kind === 'header')) {
    split += 1;
  }
  return { head: rows.slice(0, split), body: rows.slice(split) };
}

/** The text autotable draws. A drawn visual draws its own. */
function contentOf(cell: ExportCell): string {
  switch (cell.visual?.kind) {
    case 'tags':
    case 'check':
      return '';
    case 'link':
      return cell.visual.label;
    default:
      return cell.text;
  }
}

function cellStyles(row: ExportRow, cell: ExportCell, palette: PdfPalette): Partial<Styles> {
  const styles: Partial<Styles> = {};
  const style = cell.style;
  if (style?.bold || row.kind === 'group' || row.kind === 'summary') {
    styles.fontStyle = 'bold';
  }
  if (row.kind === 'group') {
    styles.fillColor = palette.header;
  }
  if (row.kind === 'summary') {
    styles.lineWidth = { top: HAIRLINE * 1.5, bottom: HAIRLINE };
    styles.lineColor = palette.border;
  }
  // The grid aligns summary values to the end and every other cell to the start.
  const summary = row.kind === 'summary' || row.kind === 'group' || row.kind === 'groupFooter';
  const align = style?.align ?? (summary && cell.type === 'number' ? 'end' : 'start');
  styles.halign = align === 'end' ? 'right' : align === 'center' ? 'center' : 'left';
  if (cell.indent > 0) {
    styles.cellPadding = { ...CELL_PADDING, left: CELL_PADDING.left + cell.indent * INDENT };
  }
  if (cell.visual?.kind === 'link') {
    styles.textColor = palette.accentText;
  }
  const fill = style?.fill == null ? null : hexColor(style.fill);
  if (fill != null) {
    styles.fillColor = fill;
  }
  const color = style?.color == null ? null : hexColor(style.color);
  if (color != null) {
    styles.textColor = color;
  }
  if (style?.fontSize != null) {
    styles.fontSize = style.fontSize * (FONT_SIZE / 11);
  }
  return styles;
}

/** A host's `#RRGGBB` from `beforeExport`. */
function hexColor(value: string): PdfColor | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim());
  return match == null
    ? null
    : [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function exportedCell(map: WeakMap<object, ExportCell>, data: CellHookData): ExportCell | null {
  const raw = data.cell.raw;
  return typeof raw === 'object' && raw !== null ? (map.get(raw) ?? null) : null;
}

function spanWidth(widths: readonly number[], start: number, span: number): number {
  return widths.slice(start, start + span).reduce((sum, width) => sum + width, 0);
}

function padX(cell: ExportCell): number {
  return CELL_PADDING.left + cell.indent * INDENT + CELL_PADDING.right;
}

/** Tags in lines that fit `width`. A tag wider than a line is shortened with an ellipsis. */
function layoutTags(
  doc: jsPDF,
  faces: PdfFaces,
  tags: readonly ExportTag[],
  width: number,
): PlacedTag[][] {
  doc.setFont(faces.family, faces.medium);
  doc.setFontSize(TAG.fontSize);
  const lines: PlacedTag[][] = [[]];
  let used = 0;
  for (const tag of tags) {
    const label = fitText(doc, tag.label, width - TAG.padX * 2);
    const tagWidth = doc.getTextWidth(label) + TAG.padX * 2;
    const line = lines[lines.length - 1];
    if (line.length > 0 && used + TAG.gap + tagWidth > width) {
      lines.push([{ tag, label, width: tagWidth }]);
      used = tagWidth;
    } else {
      used += (line.length > 0 ? TAG.gap : 0) + tagWidth;
      line.push({ tag, label, width: tagWidth });
    }
  }
  return lines;
}

function fitText(doc: jsPDF, text: string, width: number): string {
  if (doc.getTextWidth(text) <= width) {
    return text;
  }
  let end = text.length;
  while (end > 1 && doc.getTextWidth(`${text.slice(0, end)}…`) > width) {
    end -= 1;
  }
  return `${text.slice(0, end)}…`;
}

function drawVisual(
  doc: jsPDF,
  faces: PdfFaces,
  palette: PdfPalette,
  baseUrl: string,
  data: CellHookData,
  cell: ExportCell,
  visual: ExportCellVisual,
): void {
  const box = data.cell;
  const left = box.x + CELL_PADDING.left + cell.indent * INDENT;
  const middle = box.y + box.height / 2;
  switch (visual.kind) {
    case 'tags': {
      const lines = layoutTags(doc, faces, visual.tags, box.width - padX(cell));
      const blockHeight = lines.length * TAG.height + (lines.length - 1) * TAG.lineGap;
      let y = middle - blockHeight / 2;
      for (const line of lines) {
        let x = left;
        for (const placed of line) {
          drawTag(doc, palette, placed, x, y);
          x += placed.width + TAG.gap;
        }
        y += TAG.height + TAG.lineGap;
      }
      return;
    }
    case 'check':
      drawCheck(doc, palette, visual.checked, left, middle);
      // Invisible text keeps the value searchable and copyable.
      doc.setFont(faces.family, 'normal');
      doc.setFontSize(FONT_SIZE);
      doc.text(cell.text, left, middle, { baseline: 'middle', renderingMode: 'invisible' });
      return;
    case 'link':
      drawLink(doc, palette, baseUrl, data, visual.href);
      return;
  }
}

function drawTag(doc: jsPDF, palette: PdfPalette, placed: PlacedTag, x: number, y: number): void {
  const radius = TAG.height / 2;
  const tone = placed.tag.tone === 'neutral' ? null : palette.tones[placed.tag.tone];
  if (tone == null) {
    doc.setFillColor(...palette.tagFill);
    doc.setDrawColor(...palette.tagBorder);
    doc.setLineWidth(HAIRLINE);
    doc.roundedRect(x, y, placed.width, TAG.height, radius, radius, 'FD');
    doc.setTextColor(...palette.text);
  } else {
    doc.setFillColor(...tone.fill);
    doc.roundedRect(x, y, placed.width, TAG.height, radius, radius, 'F');
    doc.setTextColor(...tone.text);
  }
  doc.text(placed.label, x + TAG.padX, y + TAG.height / 2, { baseline: 'middle' });
}

/** The check of the boolean cell in the success color, or its muted dash. */
function drawCheck(
  doc: jsPDF,
  palette: PdfPalette,
  checked: boolean,
  x: number,
  middle: number,
): void {
  const size = CHECK_SIZE;
  const top = middle - size / 2;
  doc.setLineWidth(1.2);
  doc.setLineCap('round');
  doc.setLineJoin('round');
  if (checked) {
    doc.setDrawColor(...palette.tones.success.fill);
    doc.lines(
      [
        [size * 0.35, size * 0.35],
        [size * 0.65, -size * 0.8],
      ],
      x,
      top + size * 0.5,
    );
  } else {
    doc.setDrawColor(...palette.textMuted);
    doc.line(x, middle, x + size * 0.8, middle);
  }
  doc.setLineCap('butt');
  doc.setLineJoin('miter');
}

/** Underlines the text autotable drew, and makes the cell open the link. */
function drawLink(
  doc: jsPDF,
  palette: PdfPalette,
  baseUrl: string,
  data: CellHookData,
  href: string,
): void {
  const cell = data.cell;
  const lines = cell.text;
  const fontSize = cell.styles.fontSize;
  doc.setFont(cell.styles.font, cell.styles.fontStyle);
  doc.setFontSize(fontSize);
  const lineHeight = fontSize * doc.getLineHeightFactor();
  const top = cell.y + (cell.height - lines.length * lineHeight) / 2;
  const left = cell.getTextPos().x;
  doc.setDrawColor(...palette.accentText);
  doc.setLineWidth(HAIRLINE);
  lines.forEach((line, index) => {
    const width = doc.getTextWidth(line);
    const x = cell.styles.halign === 'right' ? left - width : left;
    const y = top + (index + 1) * lineHeight - lineHeight * 0.12;
    doc.line(x, y, x + width, y);
  });
  const url = absoluteUrl(href, baseUrl);
  if (url != null) {
    doc.link(cell.x, cell.y, cell.width, cell.height, { url });
  }
}

/** A relative `href` means nothing to a PDF reader, so it resolves against the page. */
function absoluteUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}
