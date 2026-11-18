/** A file in the upload queue, or one that did not make it. The saved photos are listed apart. */
export interface PhotoUpload {
  /** Local only: tracks the tile while it has no photo id. */
  readonly key: number;
  readonly name: string;
  readonly file: File;
  /** The refusal, translated. `null` while the file waits or goes up. */
  readonly error: string | null;
}
