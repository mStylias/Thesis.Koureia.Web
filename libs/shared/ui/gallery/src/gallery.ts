import { Component, computed, input, signal } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideImages } from '@lucide/angular';
import { Button } from '@ui/button';

import { GALLERY_MOSAIC_TILES } from './gallery.constants';
import type { GalleryImage } from './gallery.types';
import { GalleryViewer } from './viewer/gallery-viewer';

/**
 * A set of photos led by one main photo, with a full-screen viewer.
 *
 * ```ts
 * import { Gallery, type GalleryImage } from '@ui/gallery';
 * ```
 *
 * ```html
 * <lib-gallery [images]="photos" />
 * ```
 *
 * - **Wide screens:** a mosaic of the main photo and up to four more. A "show all" button opens
 *   the viewer when there are more photos than tiles.
 * - **Phones:** one photo at a time, swiped sideways, with a counter.
 * - **Viewer:** any photo opens it at that photo. Buttons, arrow keys and swipe step through it.
 *   `Escape`, the close button and the browser back gesture close it.
 *
 * The first photo is the main one and loads at high priority. Every other photo loads lazily.
 * An empty `images` renders nothing, so the consumer owns the placeholder.
 */
@Component({
  selector: 'lib-gallery',
  imports: [Button, GalleryViewer, LucideImages, TranslocoPipe, UiCopyPipe],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
  host: {
    '[attr.data-count]': 'tiles().length',
  },
  providers: [
    provideTranslocoScope({
      scope: 'gallery',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
})
export class Gallery {
  /** The photos, main photo first. */
  readonly images = input.required<readonly GalleryImage[]>();

  /** The accessible name of the gallery. Falls back to the translated "Photos". */
  readonly ariaLabel = input('');

  protected readonly tiles = computed(() => this.images().slice(0, GALLERY_MOSAIC_TILES));

  /** Whether the mosaic leaves photos out, which is when it offers "show all". */
  protected readonly truncated = computed(() => this.images().length > this.tiles().length);

  /** The photo the phone strip is showing, 0-based. */
  protected readonly stripIndex = signal(0);

  protected readonly viewerOpen = signal(false);
  protected readonly viewerIndex = signal(0);

  /** Opens the viewer at one photo. */
  open(index = 0): void {
    this.viewerIndex.set(index);
    this.viewerOpen.set(true);
  }

  /**
   * Follows the strip's scroll position. The strip snaps one photo per page, so the page is the
   * photo.
   */
  protected onStripScroll(strip: HTMLElement): void {
    if (strip.clientWidth === 0) return;
    const index = Math.round(strip.scrollLeft / strip.clientWidth);
    if (index !== this.stripIndex()) this.stripIndex.set(index);
  }
}
