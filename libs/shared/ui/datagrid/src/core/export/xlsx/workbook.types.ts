import type { ExportCellStyle } from '../../types/export.types';

/** A logo the banner draws, as the bytes of a PNG plus the size it is drawn at. */
export interface XlsxLogo {
  /** PNG bytes. The writer embeds them untouched. */
  png: Uint8Array<ArrayBuffer>;
  /** Drawn width in pixels. */
  width: number;
  /** Drawn height in pixels. */
  height: number;
}

/**
 * The brand a workbook carries: a banner above the table and an accented
 * header. Every field is independent, and an absent field leaves that part of
 * the sheet exactly as an unbranded export writes it.
 */
export interface XlsxBranding {
  /** Banner title. Falls back to the sheet name. */
  title?: string;
  /** A second banner line under the title, such as the product name. */
  subtitle?: string;
  logo?: XlsxLogo;
  /** Header fill as `#RRGGBB`. Without one the header stays bold text only. */
  accent?: string;
  /** Header text over `accent`. Default `#FFFFFF`. */
  onAccent?: string;
  /** Banner and total-row fill as `#RRGGBB`. */
  band?: string;
  /** Subtitle color as `#RRGGBB`. */
  muted?: string;
}

/** Options the `xlsx` adapter accepts. */
export interface XlsxOptions {
  /** Freeze the header rows so they stay visible while scrolling. Default `true`. */
  freezeHeader?: boolean;
  /**
   * IANA timezone the date serials are written in. Dates must match what the
   * grid displayed (§17), and a serial carries no zone of its own.
   */
  timezone?: string;
  /** Brand dressing. Absent means a plain workbook. */
  branding?: XlsxBranding;
}

/** One resolved cell format: a style index plus what the cell writes. */
export interface StyleTable {
  /** Distinct number-format strings, in registration order. */
  formats: string[];
  /** Distinct fonts as `bold|italic|color|size`. */
  fonts: string[];
  /** Distinct fill colors. */
  fills: string[];
  /** Distinct `xf` records as `fontIndex|fillIndex|formatId|align|wrap`. */
  records: string[];
  indexOf: (style: ExportCellStyle | null, numberFormat: string | undefined) => number;
}
