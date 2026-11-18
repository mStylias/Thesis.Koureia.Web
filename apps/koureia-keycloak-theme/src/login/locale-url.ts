/**
 * Pins a Keycloak `login-actions` URL to a language.
 *
 * Keycloak ranks the user's stored `locale` attribute above the language of the page when it
 * chooses the language of an email. An anonymous page has no user to read that attribute from, so
 * the forgot-password form renders in Greek from `ui_locales` while the mail it sends comes out in
 * whatever the account was last saved as. `kc_locale` outranks the attribute and settles both.
 *
 * The URLs on `kcContext.url` are root-relative, so this edits the query string rather than going
 * through `URL`, which needs a base and throws without one.
 */
export function withKcLocale(url: string, languageTag: string): string {
  if (languageTag === '') return url;

  const [beforeHash, ...hashParts] = url.split('#');
  const hash = hashParts.length > 0 ? `#${hashParts.join('#')}` : '';
  const [path, ...queryParts] = beforeHash.split('?');

  const params = new URLSearchParams(queryParts.join('?'));
  params.set('kc_locale', languageTag);

  return `${path}?${params.toString()}${hash}`;
}
