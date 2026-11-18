import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthEntry } from '@auth/feature-session';
import { SessionStore } from '@auth/data-access';

/**
 * The landing page's own way in.
 *
 * The header carries the same action, but a header is where someone looks when they have
 * already decided. This is for the visitor who has just read what the product does and needs
 * the reason to have an account put next to the button — which is why the copy lives here and
 * not in `AuthEntry`.
 *
 * It disappears for a signed-in person and for nobody else. While the session is still being
 * decided it stays, with `AuthEntry` holding the invisible action footprint: an undecided
 * session is what a prerendered page always holds, and the anonymous view is the right thing
 * for that HTML to contain.
 */
@Component({
  selector: 'lib-landing-auth',
  imports: [AuthEntry, TranslocoPipe],
  templateUrl: './landing-auth.html',
  styleUrl: './landing-auth.scss',
})
export class LandingAuth {
  protected readonly session = inject(SessionStore);
}
