/** An image's own size, in its pixels. */
export interface CropImageSize {
  readonly width: number;
  readonly height: number;
}

/** A point in the image's own pixels. */
export interface CropPoint {
  readonly x: number;
  readonly y: number;
}

/** Where the image sits in the square, as percentages of the square's side. */
export interface CropLayout {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
}

/** The square the crop takes, in the image's own pixels. */
export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly side: number;
}
