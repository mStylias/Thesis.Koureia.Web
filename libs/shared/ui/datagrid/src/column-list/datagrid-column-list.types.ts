/** One band above a column. */
export interface ChooserBand {
  id: string;
  caption: string;
}

/** One row of the chooser list. */
export interface ChooserEntry {
  id: string;
  caption: string;
  visible: boolean;
  hideable: boolean;
  /** Bands above the column, outermost first. Empty when it is ungrouped. */
  bands: readonly ChooserBand[];
}

/** A run of entries that share a band, with the headings that open it. */
export interface ChooserSection {
  /** Identity of the run, so a re-render tracks it. */
  key: string;
  /** How deep the entries sit, which is what indents them. */
  depth: number;
  /** Only the bands this run opens; the ones above it are already written. */
  headings: readonly { caption: string; depth: number }[];
  entries: readonly ChooserEntry[];
}
