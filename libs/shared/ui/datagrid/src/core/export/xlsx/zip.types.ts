/** One file inside the archive. */
export interface ZipEntry {
  /** Path inside the archive, with forward slashes and no leading one. */
  path: string;
  data: Uint8Array<ArrayBuffer>;
}
