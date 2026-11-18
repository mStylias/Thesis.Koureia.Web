/** Where a field's label sits. */
export type FieldLabelStyle = 'ifta' | 'float' | 'plain';

/** What an editor template is handed, for a control that cannot take `libFieldControl`. */
export interface FieldEditorContext {
  /** The id the label points at. Put it on the control. */
  readonly $implicit: string;
  readonly id: string;
  /** The ids of the hint and the message, composed. Empty when there are none. */
  readonly describedBy: string;
}

/** What a view template is handed. */
export interface FieldViewContext<TValue> {
  readonly $implicit: TValue;
  readonly value: TValue;
  /** The value as the field's spec reads it, or the empty string when there is nothing. */
  readonly text: string;
}
