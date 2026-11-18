/** One document's lock, and the inline `overflow` to put back when the last holder goes. */
export interface ScrollLockState {
  count: number;
  previousOverflow: string;
}
