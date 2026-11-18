/** One photo of a gallery. */
export interface GalleryImage {
  /** An absolute or root-relative URL. */
  readonly src: string;
  /** What the photo shows. Read aloud, and shown under the photo in the viewer. */
  readonly alt: string;
  /** The intrinsic width in pixels. Lets the browser reserve the space before the photo loads. */
  readonly width?: number;
  /** The intrinsic height in pixels. */
  readonly height?: number;
}
