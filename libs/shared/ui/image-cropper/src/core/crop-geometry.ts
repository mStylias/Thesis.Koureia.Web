import type { CropImageSize, CropLayout, CropPoint, CropRect } from './crop-geometry.types';

/*
 * The crop is a square of the image, held as its center in the image's own pixels and a zoom. At
 * zoom 1 the square's side is the image's shorter side, so the image always covers the square.
 * Nothing here depends on the square's size on screen: the layout is in percentages, and only a
 * drag converts screen pixels.
 */

/** The square's side in the image's pixels. */
export function visibleSide(image: CropImageSize, zoom: number): number {
  return Math.min(image.width, image.height) / Math.max(zoom, 1);
}

/** The image's center: where a new image starts. */
export function centerOf(image: CropImageSize): CropPoint {
  return { x: image.width / 2, y: image.height / 2 };
}

/** Keeps the square inside the image. */
export function clampCenter(image: CropImageSize, center: CropPoint, zoom: number): CropPoint {
  const half = visibleSide(image, zoom) / 2;
  return {
    x: clamp(center.x, half, image.width - half),
    y: clamp(center.y, half, image.height - half),
  };
}

/** Moves the square by a drag of `dx`, `dy` screen pixels over a square `viewport` pixels wide. */
export function panBy(
  image: CropImageSize,
  center: CropPoint,
  zoom: number,
  dx: number,
  dy: number,
  viewport: number,
): CropPoint {
  if (viewport <= 0) return center;
  // Dragging the image right shows what is to its left: the center moves the other way.
  const scale = visibleSide(image, zoom) / viewport;
  return clampCenter(image, { x: center.x - dx * scale, y: center.y - dy * scale }, zoom);
}

/** The image's box inside the square, so CSS can place it without measuring. */
export function layoutOf(image: CropImageSize, center: CropPoint, zoom: number): CropLayout {
  const side = visibleSide(image, zoom);
  return {
    width: (image.width / side) * 100,
    height: (image.height / side) * 100,
    left: (0.5 - center.x / side) * 100,
    top: (0.5 - center.y / side) * 100,
  };
}

/** The part of the image the crop keeps. */
export function cropRectOf(image: CropImageSize, center: CropPoint, zoom: number): CropRect {
  const side = visibleSide(image, zoom);
  return { x: center.x - side / 2, y: center.y - side / 2, side };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
