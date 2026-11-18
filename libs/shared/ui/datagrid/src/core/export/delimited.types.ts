import type { ExportRow } from '../types/export.types';

/** How one table becomes delimited text. */
export interface DelimitedOptions {
  /** Field separator. `,` for CSV, a tab for the clipboard. */
  delimiter?: string;
  /** Row separator. CRLF by default, which every spreadsheet reads. */
  newline?: string;
  /** Prefix a UTF-8 byte-order mark. Default `true` for a file, `false` for text. */
  bom?: boolean;
  /** Row kinds to leave out. */
  skip?: readonly ExportRow['kind'][];
}
