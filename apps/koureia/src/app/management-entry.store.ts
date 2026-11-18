import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';

/**
 * The address `app.routes.ts` publishes the barber's workspace at. It carries no `:lang`
 * segment, so this is the whole prefix.
 */
export const MANAGEMENT_PREFIX = '/management';

/**
 * Floor on how long the splash stays up, in milliseconds. Matches `@ui/loading-screen`'s own
 * default, which this store overrides per entry.
 */
const MIN_SPLASH_MS = 1000;

/** The pre-bootstrap copy of the splash in `index.html`. */
const DOCUMENT_SPLASH_ID = 'app-splash';

/**
 * Whether the workspace is being reached for the first time this page load, which is the one
 * wait in the app that has nothing to show.
 *
 * `/management` is the only client-rendered area — see the `RenderMode.Client` entry in
 * `app.routes.server.ts` — so arriving there costs a chunk fetch, the shell's two dictionaries
 * and the sidebar's stored state before a single pixel of the workspace exists. `App` covers
 * that with `lib-loading-screen`.
 *
 * Once only. Moving between pages inside the workspace reuses the shell that is already on the
 * screen, and a splash over a layout that never left would be a step backwards, not feedback.
 *
 * A cold load is the harder half. The browser is handed an empty document, and the bundle
 * download and bootstrap is the longest part of the wait with nothing on the screen, so
 * `index.html` paints the splash itself. This store finds that copy before the first Angular
 * paint, raises `entering` so the component is already in it, and hands `App` the node to drop
 * once it is.
 */
@Service()
export class ManagementEntryStore {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Read by `App` and handed to the splash as its `loading` flag. */
  readonly entering = signal(false);

  /**
   * Floor for the current entry, in milliseconds. On a cold load the person has been waiting
   * since the document arrived, so the floor is what is left of it rather than a fresh 500ms on
   * top of a bootstrap that already took longer than that.
   */
  readonly floorMs = signal(MIN_SPLASH_MS);

  /**
   * Whether a splash was on the screen before Angular existed. `App` uses it to suppress the
   * mark's entrance, which has already played on the pre-bootstrap copy.
   */
  readonly adoptedDocumentSplash = signal(false);

  /** The pre-bootstrap node, until `App` drops it. */
  private documentSplash: Element | null = null;

  /** Set on arrival, not on departure: a navigation a guard turned away has covered nothing. */
  private arrived = false;

  /** Called once from `provideAppInitializer`, before the first render and the first navigation. */
  start(): void {
    this.adoptDocumentSplash();

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        if (this.arrived || !isManagementUrl(event.url)) return;
        // Only a cold load inherits a part-spent floor. A navigation from a page the person was
        // reading starts its wait here.
        if (!this.adoptedDocumentSplash()) this.floorMs.set(MIN_SPLASH_MS);
        this.entering.set(true);
        return;
      }

      if (event instanceof NavigationEnd) {
        this.adoptedDocumentSplash.set(false);
        // `urlAfterRedirects`, because a redirect is what decides where this navigation landed.
        if (isManagementUrl(event.urlAfterRedirects)) this.arrived = true;
        this.entering.set(false);
        return;
      }

      if (
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      ) {
        this.entering.set(false);
      }
    });
  }

  /**
   * Drops the pre-bootstrap splash. Called from `App` after the first render, so the component's
   * own overlay is already on the screen and no frame shows an empty one.
   *
   * Angular clears the root element's contents on bootstrap, so this is usually a no-op on an
   * already detached node. It stays explicit rather than relying on that.
   */
  dismissDocumentSplash(): void {
    this.documentSplash?.remove();
    this.documentSplash = null;
  }

  /**
   * Reads the pre-bootstrap splash, if `index.html` left one for this address, and carries its
   * state into the component. Runs before the first render, so the component draws the splash in
   * the same paint that would otherwise have blanked the screen.
   */
  private adoptDocumentSplash(): void {
    if (!this.isBrowser) return;

    this.documentSplash = this.document.getElementById(DOCUMENT_SPLASH_ID);
    if (this.documentSplash === null) return;

    this.adoptedDocumentSplash.set(true);
    this.entering.set(true);
    // `performance.now()` counts from the navigation, which is when the wait began.
    this.floorMs.set(Math.max(0, MIN_SPLASH_MS - performance.now()));
  }
}

/** The workspace itself or any page below it. */
export function isManagementUrl(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  return path === MANAGEMENT_PREFIX || path.startsWith(`${MANAGEMENT_PREFIX}/`);
}
