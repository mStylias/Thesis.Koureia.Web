/**
 * Loads the next page when the end of the rows comes into range.
 *
 * A sentinel inside the scroll viewport, watched by one `IntersectionObserver`
 * — not a scroll handler, which would do arithmetic on every scroll frame to
 * answer a question the platform answers for free.
 *
 * It owns the observer and the "still in range" flag, which is what earns it a
 * file: the flag is the difference between one load per arrival at the end and
 * one load per page, because an observer reports a crossing and says nothing
 * more while the sentinel stays put.
 *
 * The load-more button stays whatever this does. An affordance reachable only
 * by scrolling is no affordance for a keyboard user, and a page that grows on
 * its own must still be reachable by pressing something.
 */
import { AUTO_LOAD_MARGIN } from '../datagrid.constants';
import type { AutoLoadDeps } from './auto-load.types';

export class AutoLoad {
  private observer: IntersectionObserver | null = null;
  private root: HTMLElement | null = null;
  private sentinel: HTMLElement | null = null;
  private intersecting = false;

  constructor(private readonly deps: AutoLoadDeps) {}

  /**
   * Watches a sentinel inside a scroll container. Re-connecting with the same
   * pair does nothing, so this is safe to call from a render effect.
   */
  connect(root: HTMLElement, sentinel: HTMLElement): void {
    if (this.root === root && this.sentinel === sentinel && this.observer != null) {
      return;
    }
    this.disconnect();
    // Absent in jsdom and on older engines. Without it the grid keeps the
    // load-more button and nothing else changes.
    if (typeof IntersectionObserver !== 'function') {
      return;
    }
    this.root = root;
    this.sentinel = sentinel;
    this.observer = new IntersectionObserver(
      (entries) => {
        this.intersecting = entries.some((entry) => entry.isIntersecting);
        if (this.intersecting) {
          this.request();
        }
      },
      { root, rootMargin: `0px 0px ${AUTO_LOAD_MARGIN.toString()}px 0px` },
    );
    this.observer.observe(sentinel);
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.root = null;
    this.sentinel = null;
    this.intersecting = false;
  }

  /**
   * Asks again after a load settles.
   *
   * One page is often shorter than the space below the fold, which leaves the
   * sentinel where it already was — and an observer that has reported a
   * crossing reports nothing until the element crosses back. Without this the
   * list would grow by exactly one page and then stop.
   */
  poll(): void {
    if (this.intersecting) {
      this.request();
    }
  }

  private request(): void {
    if (this.deps.canLoadMore()) {
      this.deps.loadMore();
    }
  }
}
