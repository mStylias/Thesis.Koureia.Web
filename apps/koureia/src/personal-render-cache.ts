/**
 * Keeps a server render that carries a session out of every shared cache.
 *
 * A public page embeds the visitor's claims (name, email) for the header, while its route asks a
 * CDN to keep the HTML for everyone (`public, s-maxage`). That is right only for an anonymous
 * render. A signed-in render is made private here, and every shareable render varies on the cookie,
 * for the caches that honor `Vary`.
 */
export function keepPersonalRenderPrivate(response: Response, signedIn: boolean): Response {
  const cacheControl = response.headers.get('Cache-Control') ?? '';
  if (!isShareable(cacheControl)) return response;

  const headers = new Headers(response.headers);
  headers.append('Vary', 'Cookie');
  if (signedIn) headers.set('Cache-Control', 'private, no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isShareable(cacheControl: string): boolean {
  return (
    /\b(public|s-maxage)\b/i.test(cacheControl) && !/\b(private|no-store)\b/i.test(cacheControl)
  );
}
