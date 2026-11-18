import type { XlsxBranding } from './xlsx/workbook.types';

/** The logo the spreadsheet banner draws, fetched when an export runs. */
export interface DatagridExcelLogo {
  /** Where the PNG is fetched from, such as `/brand/icon.png`. */
  url: string;
  /** Drawn width in pixels. Default 28. */
  width?: number;
  /** Drawn height in pixels. Default 28. */
  height?: number;
}

/**
 * The brand a workbook carries. The colors are `#RRGGBB`, because a
 * spreadsheet holds no custom properties to read a theme from.
 */
export type DatagridExcelBranding = Omit<XlsxBranding, 'logo'> & { logo?: DatagridExcelLogo };

/** The TrueType files a PDF writes its text in, fetched when an export runs. */
export interface DatagridPdfFonts {
  /** The body face, such as `/fonts/sans-regular.ttf`. */
  regular: string;
  /** The tag face. Falls back to `regular`. */
  medium?: string;
  /** The header, group and total face. Falls back to `regular`. */
  bold?: string;
}

/** Page size of a PDF export. */
export type DatagridPdfPageSize = 'a4' | 'letter';

/** Page orientation of a PDF export. */
export type DatagridPdfOrientation = 'portrait' | 'landscape' | 'auto';

/**
 * What a PDF export carries. The colors are not here: the writer reads the
 * light theme off the page when the export runs, so the file wears the grid's
 * own palette.
 */
export interface DatagridPdfOptions {
  /**
   * The faces the text is written in. `.ttf` only: a PDF embeds TrueType, and
   * a browser's WOFF2 cannot be embedded. Without fonts the writer uses the
   * PDF standard font, which has no Greek glyphs.
   */
  fonts?: DatagridPdfFonts;
  /** Banner title. Falls back to the sheet name. */
  title?: string;
  /** A second banner line under the title, such as the product name. */
  subtitle?: string;
  /** A PNG or JPEG drawn beside the title. */
  logo?: DatagridExcelLogo;
  /** Default `'auto'`: landscape when the columns are wider than a portrait page. */
  orientation?: DatagridPdfOrientation;
  /** Default `'a4'`. */
  pageSize?: DatagridPdfPageSize;
}
