/**
 * A card on a page of cards that edits. The page asks each one before a navigation or a reload
 * drops its changes.
 */
export interface PageSectionEditor {
  /** The card is in its form, and the form differs from what was saved. */
  hasChanges(): boolean;
  /** Back to view, dropping the form's changes. The page has already asked. */
  discard(): void;
}

/** What a page tells its sections. */
export interface PageSectionsConfig {
  /** The translation key of the discard question's message. It names what the page edits. */
  readonly discardMessage: string;
}
