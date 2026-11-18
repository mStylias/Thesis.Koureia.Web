import { Location } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { LucideChevronLeft, LucideChevronRight, LucideX } from '@lucide/angular';
import { Button } from '@ui/button';
import { Dialog, DialogHeadless } from '@ui/dialog';

import { GALLERY_SWIPE_THRESHOLD } from '../gallery.constants';
import type { GalleryImage } from '../gallery.types';

/**
 * The full-screen photo viewer. One photo at a time, fit to the screen.
 *
 * Built on `lib-dialog`, so focus containment, `Escape`, background inertness and focus return
 * to the opener are the platform's.
 */
@Component({
  selector: 'lib-gallery-viewer',
  imports: [
    Button,
    Dialog,
    DialogHeadless,
    LucideChevronLeft,
    LucideChevronRight,
    LucideX,
    TranslocoPipe,
    UiCopyPipe,
  ],
  templateUrl: './gallery-viewer.html',
  styleUrl: './gallery-viewer.scss',
  host: {
    // The arrow keys are a shortcut. The previous and next buttons stay the way to step for every
    // input. Key events inside the dialog bubble through this host.
    '(keydown)': 'onKeydown($event)',
  },
})
export class GalleryViewer {
  private readonly location = inject(Location);

  /** Every photo, in order. */
  readonly images = input.required<readonly GalleryImage[]>();

  /** Whether the viewer is open. */
  readonly visible = model(false);

  /** The photo on screen, 0-based. */
  readonly index = model(0);

  protected readonly total = computed(() => this.images().length);

  protected readonly current = computed<GalleryImage | undefined>(
    () => this.images()[this.index()],
  );

  /** The photos either side of the current one. Loaded ahead, so a step shows at once. */
  protected readonly neighbors = computed(() => {
    const images = this.images();
    const at = this.index();
    const around: GalleryImage[] = [];
    if (at > 0) around.push(images[at - 1]);
    if (at < images.length - 1) around.push(images[at + 1]);
    return around;
  });

  protected readonly hasPrevious = computed(() => this.index() > 0);
  protected readonly hasNext = computed(() => this.index() < this.total() - 1);

  /** Whether the viewer's own history entry is still on the stack. */
  private historyEntry = false;

  private swipeStartX: number | null = null;

  constructor() {
    // On a phone the viewer covers the page, so the back gesture must close it and not leave
    // the page. The viewer pushes an entry at the same URL, and a close by any other way spends
    // that entry again.
    const popped = this.location.subscribe(() => {
      if (!this.historyEntry) return;
      this.historyEntry = false;
      this.visible.set(false);
    });
    inject(DestroyRef).onDestroy(() => {
      popped.unsubscribe();
    });

    effect(() => {
      const open = this.visible();

      if (open && !this.historyEntry) {
        this.location.go(this.location.path(true));
        this.historyEntry = true;
        return;
      }

      if (!open && this.historyEntry) {
        this.historyEntry = false;
        this.location.back();
      }
    });
  }

  protected previous(): void {
    if (this.hasPrevious()) this.index.update((at) => at - 1);
  }

  protected next(): void {
    if (this.hasNext()) this.index.update((at) => at + 1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    this.swipeStartX = event.clientX;
  }

  protected onPointerUp(event: PointerEvent): void {
    const start = this.swipeStartX;
    this.swipeStartX = null;
    if (start === null) return;

    const travel = event.clientX - start;
    if (travel <= -GALLERY_SWIPE_THRESHOLD) this.next();
    else if (travel >= GALLERY_SWIPE_THRESHOLD) this.previous();
  }

  protected onPointerCancel(): void {
    this.swipeStartX = null;
  }
}
