import { HttpContextToken } from '@angular/common/http';

/**
 * Marks one request whose response may cross hydration inside the transfer cache.
 *
 * The app excludes every API response from that cache by default, because a response the
 * server rendered for one visitor must not be embedded in HTML another visitor can be served.
 * A server-rendered page whose data is excluded, though, refetches it the moment the browser
 * takes over, and the content it already painted is replaced by a loading state for one round
 * trip.
 *
 * This token is the narrow way out. Set it only on a GET that is anonymous, that reads no
 * caller identity, and whose answer is the same for everyone who asks in that language.
 *
 * ```ts
 * this.http.get<Thing[]>(url, {
 *   context: new HttpContext().set(PUBLIC_TRANSFERABLE, true),
 * });
 * ```
 *
 * The default is `false`, so a call that says nothing keeps the strict rule.
 */
export const PUBLIC_TRANSFERABLE = new HttpContextToken<boolean>(() => false);
