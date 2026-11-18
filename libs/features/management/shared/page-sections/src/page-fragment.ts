import { afterNextRender, DOCUMENT, effect, inject, Injector } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PageLoading } from './page-loading';

/**
 * Brings the card named by the route's fragment into view once, after every card has loaded. A
 * card that loads later grows or goes away, and moves the card below it. Call it in the page's
 * constructor.
 *
 * The router's anchor scrolling moves the window. The page scrolls inside the shell's content
 * area, so the scroll is done here.
 */
export function openPageAtFragment(): void {
  const fragment = inject(ActivatedRoute).snapshot.fragment;
  if (!fragment) return;
  const loading = inject(PageLoading);
  const document = inject(DOCUMENT);
  const injector = inject(Injector);

  let done = false;
  const watch = effect(() => {
    if (done || !loading.settled()) return;
    afterNextRender(
      () => {
        // A card can start to load in the render that came first, so ask again.
        if (done || !loading.settled()) return;
        done = true;
        watch.destroy();
        document.getElementById(fragment)?.scrollIntoView({ block: 'start' });
      },
      { injector },
    );
  });
}
