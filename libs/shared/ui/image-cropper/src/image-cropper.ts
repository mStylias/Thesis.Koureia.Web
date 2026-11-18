import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  numberAttribute,
  signal,
  viewChild,
} from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { LucideZoomIn, LucideZoomOut } from '@lucide/angular';
import { UiCopyPipe } from '@util/ui-copy';

import { centerOf, clamp, clampCenter, cropRectOf, layoutOf, panBy } from './core/crop-geometry';
import type { CropImageSize, CropPoint } from './core/crop-geometry.types';
import type { ImageCropperShape } from './image-cropper.types';

/** How far an arrow key moves the square, as a share of its side. */
const KEY_PAN_SHARE = 0.05;

/** How much `+` and `-` change the zoom. */
const KEY_ZOOM_STEP = 0.1;

let nextId = 0;

/**
 * Crops an image to a square: drag or arrow keys to move, the slider or `+`/`-` to zoom. The
 * browser applies the photo's EXIF orientation, so a phone picture is upright here and in the
 * output.
 *
 * ```ts
 * import { ImageCropper } from '@ui/image-cropper';
 * ```
 *
 * ```html
 * <lib-image-cropper #cropper [source]="file" shape="circle" />
 * <button (click)="save(cropper)">Save</button>
 * ```
 *
 * ```ts
 * const blob = await cropper.crop(); // WebP, or JPEG where the browser cannot encode WebP
 * ```
 *
 * The output is a convenience, not a guarantee: a server that stores the image must decode,
 * crop and re-encode it again.
 */
@Component({
  selector: 'lib-image-cropper',
  imports: [LucideZoomIn, LucideZoomOut, TranslocoPipe, UiCopyPipe],
  templateUrl: './image-cropper.html',
  styleUrl: './image-cropper.scss',
  providers: [
    provideTranslocoScope({
      scope: 'imageCropper',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    '[attr.data-shape]': 'shape()',
  },
})
export class ImageCropper {
  private readonly area = viewChild.required<ElementRef<HTMLElement>>('area');
  private readonly image = viewChild<ElementRef<HTMLImageElement>>('image');

  /** The image to crop. A new one starts centered, at zoom 1. */
  readonly source = input<Blob | null>(null);

  /** The mask drawn over the square. The output is a square either way. */
  readonly shape = input<ImageCropperShape>('circle');

  /** The side of the square `crop()` produces, in pixels. */
  readonly outputSize = input(1024, { transform: numberAttribute });

  /** The furthest the slider zooms in. `1` shows the image's shorter side whole. */
  readonly maxZoom = input(4, { transform: numberAttribute });

  /** Name of the crop area. Falls back to the translated default. */
  readonly ariaLabel = input('');

  /** The instructions under the area. Falls back to the translated default. */
  readonly hint = input('');

  /** Name of the zoom slider. Falls back to the translated default. */
  readonly zoomAriaLabel = input('');

  protected readonly hintId = `image-cropper-hint-${nextId++}`;

  /** An object URL for `source`, revoked when it changes or the cropper goes. */
  protected readonly url = signal<string | null>(null);

  private readonly size = signal<CropImageSize | null>(null);
  private readonly center = signal<CropPoint>({ x: 0, y: 0 });
  protected readonly zoom = signal(1);

  /** The image could not be decoded. */
  readonly failed = signal(false);

  /** An image is on screen and `crop()` has something to cut. */
  readonly ready = computed(() => this.size() !== null);

  protected readonly safeMaxZoom = computed(() => Math.max(1, this.maxZoom() || 1));

  protected readonly layout = computed(() => {
    const size = this.size();
    return size === null ? null : layoutOf(size, this.center(), this.zoom());
  });

  private drag: { readonly pointerId: number; x: number; y: number } | null = null;

  constructor() {
    effect((onCleanup) => {
      const source = this.source();
      this.size.set(null);
      this.failed.set(false);
      this.zoom.set(1);
      if (source === null) {
        this.url.set(null);
        return;
      }
      const url = URL.createObjectURL(source);
      this.url.set(url);
      onCleanup(() => {
        URL.revokeObjectURL(url);
      });
    });
  }

  /**
   * The kept square, `outputSize` wide. `null` before an image loads, or where the browser has
   * no canvas.
   */
  async crop(): Promise<Blob | null> {
    const size = this.size();
    const image = this.image()?.nativeElement;
    if (size === null || image === undefined) return null;

    const side = Math.max(1, Math.round(this.outputSize() || 1));
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    if (context === null) return null;

    const rect = cropRectOf(size, this.center(), this.zoom());
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, rect.x, rect.y, rect.side, rect.side, 0, 0, side, side);

    // Safari before 17 answers a WebP request with a PNG, which is far larger than a JPEG.
    const webp = await toBlob(canvas, 'image/webp');
    return webp?.type === 'image/webp' ? webp : toBlob(canvas, 'image/jpeg');
  }

  protected onLoad(event: Event): void {
    const image = event.target as HTMLImageElement;
    const size = { width: image.naturalWidth, height: image.naturalHeight };
    if (size.width === 0 || size.height === 0) {
      this.failed.set(true);
      return;
    }
    this.size.set(size);
    this.center.set(centerOf(size));
  }

  protected onError(): void {
    this.failed.set(true);
  }

  protected setZoom(value: number): void {
    const size = this.size();
    const zoom = clamp(value, 1, this.safeMaxZoom());
    this.zoom.set(zoom);
    if (size !== null) this.center.set(clampCenter(size, this.center(), zoom));
  }

  protected onZoomInput(event: Event): void {
    this.setZoom(Number((event.target as HTMLInputElement).value));
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.size() === null || event.button !== 0) return;
    this.area().nativeElement.setPointerCapture(event.pointerId);
    this.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    const size = this.size();
    if (drag === null || size === null || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    const viewport = this.area().nativeElement.clientWidth;
    this.center.set(panBy(size, this.center(), this.zoom(), dx, dy, viewport));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.drag = null;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const size = this.size();
    if (size === null) return;
    const viewport = this.area().nativeElement.clientWidth || 100;
    const step = viewport * KEY_PAN_SHARE;
    const moves: Readonly<Partial<Record<string, readonly [number, number]>>> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (move !== undefined) {
      // An arrow moves the square, which shows the image moving the other way.
      this.center.set(panBy(size, this.center(), this.zoom(), move[0], move[1], viewport));
    } else if (event.key === '+' || event.key === '=') {
      this.setZoom(this.zoom() + KEY_ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      this.setZoom(this.zoom() - KEY_ZOOM_STEP);
    } else {
      return;
    }
    event.preventDefault();
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, 0.9);
  });
}
