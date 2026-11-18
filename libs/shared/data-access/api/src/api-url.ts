/**
 * Whether a request URL addresses our own API.
 *
 * This scopes every cross-cutting HTTP rule. The app also calls Keycloak and third parties,
 * and bearer tokens, error shapes and credential policy must not reach them. An unset
 * `baseUrl` means same-origin: then only the `/api/` paths `synaxUrl` builds are ours.
 */
export function isApiUrl(url: string, baseUrl: string | undefined): boolean {
  // Not every relative URL: the BFF's `/auth/token` would then wait for a token from itself.
  if (!baseUrl) return url.startsWith(SAME_ORIGIN_API_PATH);

  const normalized = baseUrl.replace(/\/+$/, '');
  // A boundary check, not a prefix check. `http://localhost:7000.evil.test` must not match.
  return url === normalized || url.startsWith(`${normalized}/`);
}

const SAME_ORIGIN_API_PATH = '/api/';
