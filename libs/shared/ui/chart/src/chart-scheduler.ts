import { DOCUMENT, inject, Service } from '@angular/core';

/** The longest wait for an idle slot, in milliseconds. After it, the chart draws anyway. */
const IDLE_TIMEOUT = 150;

/**
 * Draws one chart per idle slot of the browser.
 *
 * A first draw costs tens of milliseconds. A tab that draws all its charts in one task freezes
 * the page, and its enter motion, for the sum. One chart per slot gives the frames back.
 */
@Service()
export class ChartScheduler {
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly queue: (() => void)[] = [];
  private waiting = false;

  /** Queues `job` after the jobs before it. Returns a function that drops it. */
  schedule(job: () => void): () => void {
    this.queue.push(job);
    this.next();
    return () => {
      const index = this.queue.indexOf(job);
      if (index >= 0) {
        this.queue.splice(index, 1);
      }
    };
  }

  private next(): void {
    if (this.waiting || this.queue.length === 0) {
      return;
    }
    this.waiting = true;
    const run = (): void => {
      this.waiting = false;
      try {
        this.queue.shift()?.();
      } finally {
        this.next();
      }
    };
    if (this.view && typeof this.view.requestIdleCallback === 'function') {
      this.view.requestIdleCallback(run, { timeout: IDLE_TIMEOUT });
    } else {
      setTimeout(run, 0);
    }
  }
}
