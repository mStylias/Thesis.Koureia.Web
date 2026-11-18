import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import type { CellLayoutSource } from './cell-layout.types';

/**
 * What a cell renderer may know about the space it draws in, without measuring its own cell.
 * Provided by each grid, so a renderer injects it and reads its column's declared width.
 *
 * §22 forbids an observer per row. A renderer that fits content to its cell reads the width the
 * layout already computed, and reads CSS lengths once per grid and density into {@link record}.
 */
@Injectable()
export class DatagridCellLayout {
  private source: CellLayoutSource | null = null;
  private readonly measurements = signal<ReadonlyMap<string, unknown>>(new Map());
  private readonly fontLoads = signal(0);

  /** Bumped when a web font finishes loading, so text measured in a fallback face is redone. */
  readonly fontsVersion = this.fontLoads.asReadonly();

  readonly cards = computed(() => this.source?.cards() ?? false);
  readonly density = computed(() => this.source?.density() ?? '');

  constructor() {
    const fonts = inject(DOCUMENT).fonts as FontFaceSet | undefined;
    if (fonts === undefined) return;
    const loaded = (): void => {
      this.fontLoads.update((version) => version + 1);
    };
    fonts.addEventListener('loadingdone', loaded);
    inject(DestroyRef).onDestroy(() => {
      fonts.removeEventListener('loadingdone', loaded);
    });
  }

  /** Called once by the grid that provides this, before its body renders. */
  bind(source: CellLayoutSource): void {
    this.source = source;
  }

  /** The column's resolved width, or `null` before the layout knows it. */
  widthOf(columnId: string): number | null {
    const width = this.source?.widths().get(columnId);
    return width === undefined || width <= 0 ? null : width;
  }

  /** A value a renderer read from the DOM once, shared by every cell of this grid. */
  measured(key: string): unknown {
    return this.measurements().get(key) ?? null;
  }

  record(key: string, value: unknown): void {
    this.measurements.update((current) => new Map(current).set(key, value));
  }
}
