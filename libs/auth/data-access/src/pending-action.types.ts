/** One line of a pending action's summary. */
export interface PendingActionRow {
  readonly label: string;
  readonly value: string;
}

/**
 * What a flow was about to do when it sent the person through an auth screen, in a shape the
 * auth screens can render without knowing which flow wrote it.
 *
 * Everything here is **already translated**. The writing flow owns its own copy, and the screen
 * that shows it owns none of it.
 */
export interface PendingAction {
  /** The flow that wrote it, so a reader can refuse an entry it does not understand. */
  readonly kind: string;
  /** One line above the summary, naming what is about to happen. */
  readonly title: string;
  /** The choices already made. Rendered in order. */
  readonly rows: readonly PendingActionRow[];
}
