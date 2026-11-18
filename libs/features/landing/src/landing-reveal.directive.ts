import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * Reveals a landing-page element once it enters the viewport.
 *
 * The hidden starting state is applied from the very first paint by the
 * `html.landing-motion` pre-paint gate in `index.html` (set only when JS is
 * on, motion is allowed, and IntersectionObserver exists), so SSR content is
 * never painted visible and then re-hidden. Without JS the gate class is
 * absent and the SSR content simply stays visible.
 */
@Directive({
  selector: '[libLandingReveal]',
  host: {
    class: 'landing-reveal',
    '[class.is-revealed]': 'revealed()',
  },
})
export class LandingReveal {
  readonly revealed = signal(false);

  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // `afterNextRender` runs in the browser only, so this remains SSR-safe.
    afterNextRender(() => {
      this.observe();
    });
  }

  private observe(): void {
    // Mirrors the gate in index.html: when it did not hide the content there
    // is nothing to reveal.
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      return;
    }

    const element = this.element.nativeElement as HTMLElement;

    // Elements already on screen play their entrance right away — they have
    // been hidden since first paint, so the observer would only add delay.
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < viewportHeight && rect.bottom > 0) {
      this.revealed.set(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        const entry = entries[0];
        if (!entry.isIntersecting) {
          return;
        }

        this.revealed.set(true);
        observer.unobserve(entry.target);
      },
      { threshold: 0.15 },
    );

    observer.observe(element);
    this.destroyRef.onDestroy(() => {
      observer.disconnect();
    });
  }
}
