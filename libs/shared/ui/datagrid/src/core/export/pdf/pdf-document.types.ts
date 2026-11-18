import type { ExportTag, ExportTone } from '../../types/export.types';

/** An sRGB color as 0–255 channels, the form jsPDF takes. */
export type PdfColor = [number, number, number];

/** A filled tag: its ground and the text on it. */
export interface PdfTonePair {
  fill: PdfColor;
  text: PdfColor;
}

/** The grid's light palette, resolved to channels. */
export interface PdfPalette {
  text: PdfColor;
  textSecondary: PdfColor;
  textMuted: PdfColor;
  surface: PdfColor;
  /** Header and group-row ground. */
  header: PdfColor;
  border: PdfColor;
  borderSubtle: PdfColor;
  accent: PdfColor;
  accentText: PdfColor;
  tagFill: PdfColor;
  tagBorder: PdfColor;
  tones: Record<Exclude<ExportTone, 'neutral'>, PdfTonePair>;
}

/** Font files as binary strings, the form jsPDF's virtual file system takes. */
export interface PdfFontFiles {
  regular: string;
  medium: string | null;
  bold: string | null;
}

/** A logo as bytes, plus the size it is drawn at in pixels. */
export interface PdfLogo {
  bytes: Uint8Array;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

/** Everything the writer reads from outside the table. */
export interface PdfResources {
  /** `null` writes in the PDF standard font. */
  fonts: PdfFontFiles | null;
  logo: PdfLogo | null;
  palette: PdfPalette;
  /** Resolves a relative link `href` to the address a PDF reader can open. */
  baseUrl: string;
}

/** The faces the writer draws with, once registered on a document. */
export interface PdfFaces {
  family: string;
  /** The tag face's style name. */
  medium: string;
}

/** One tag placed on a line, its label shortened to fit. */
export interface PlacedTag {
  tag: ExportTag;
  label: string;
  width: number;
}
