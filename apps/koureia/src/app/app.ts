import { afterNextRender, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionStore } from '@auth/data-access';
import { EmailUnverified, SessionExpired } from '@auth/feature-session';
import { LoadingScreen } from '@ui/loading-screen';
import { Toaster } from '@ui/toaster';
import { BRAND } from '@util/brand';

import { ManagementEntryStore } from './management-entry.store';

@Component({
  selector: 'app-root',
  imports: [EmailUnverified, LoadingScreen, RouterOutlet, SessionExpired, Toaster],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /**
   * The shell owns the session surfaces that are not routes: the expiry explanation, which has to
   * appear over whatever page the person was on, and the unverified-address reminder, which has to
   * appear on whatever page they opened.
   *
   * Everything that renders a session decision waits on `isReady()`. Static routes resolve
   * the session after hydration. Personal server renders resolve it before they send HTML.
   */
  protected readonly session = inject(SessionStore);

  /**
   * `/management` is the app's only client-rendered area, so reaching it the first time is the
   * one wait with nothing on the screen. The splash lives here and not in the workspace shell:
   * the shell is the thing being waited for, so anything inside it appears after the wait is
   * over. Eagerly imported for the same reason — a deferred splash would fetch its own chunk at
   * the moment it is needed instantly.
   */
  protected readonly managementEntry = inject(ManagementEntryStore);

  /** Read per injection, never cached at module scope — see `BrandConfig`. */
  protected readonly brand = inject(BRAND);

  constructor() {
    // After the first render, not before: on a cold load the splash in `index.html` is what is on
    // the screen, and the component's copy has to be painted before that one goes.
    afterNextRender(() => {
      this.managementEntry.dismissDocumentSplash();
    });
  }
}
