import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, effect, inject, signal } from '@angular/core';

/**
 * Whether the management sidebar stands as the icon rail, remembered between visits.
 *
 * `localStorage` and not `sessionStorage`: the rail is a working preference, like the width of a
 * pane, so a barber who narrowed it yesterday finds it narrow today and in every tab. Only the
 * desktop rail is kept. The mobile drawer covers the page it belongs to, so it opens on a press
 * and never on arrival.
 *
 * The platform guards are not ceremony: no server render can read this, so one would paint the
 * expanded rail and let the stored state jump it narrow a moment later. `/management` is client
 * rendered for that reason — see the `RenderMode.Client` entry in `app.routes.server.ts` — and
 * moving the workspace back to a server render puts the jump back.
 */
@Service()
export class SidebarCollapseStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Two-way bound by the shell to the sidebar and to the top bar's collapse toggle. */
  readonly collapsed = signal(this.read());

  constructor() {
    effect(() => {
      this.persist(this.collapsed());
    });
  }

  private read(): boolean {
    if (!this.isBrowser) return false;

    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * The expanded rail is the default, so it is stored as the absence of the key. The first run of
   * the effect then leaves nothing behind for a visitor who never worked the toggle.
   */
  private persist(collapsed: boolean): void {
    if (!this.isBrowser) return;

    try {
      if (collapsed) {
        localStorage.setItem(COLLAPSED_KEY, '1');
      } else {
        localStorage.removeItem(COLLAPSED_KEY);
      }
    } catch {
      // Private-mode quota refusal. The rail must still move, so the choice holds for this page
      // instead of the toggle refusing to work.
    }
  }
}

const COLLAPSED_KEY = 'management.sidebar-collapsed';
