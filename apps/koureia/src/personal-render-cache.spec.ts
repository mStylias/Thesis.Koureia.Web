import { describe, expect, it } from 'vitest';

import { keepPersonalRenderPrivate } from './personal-render-cache';

const SHARED = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

function render(cacheControl: string): Response {
  return new Response('<html></html>', { status: 200, headers: { 'Cache-Control': cacheControl } });
}

describe('keepPersonalRenderPrivate', () => {
  it('makes a signed-in render of a shared page private', () => {
    const response = keepPersonalRenderPrivate(render(SHARED), true);

    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Vary')).toContain('Cookie');
  });

  it('keeps an anonymous render shareable, varied on the cookie', () => {
    const response = keepPersonalRenderPrivate(render(SHARED), false);

    expect(response.headers.get('Cache-Control')).toBe(SHARED);
    expect(response.headers.get('Vary')).toContain('Cookie');
  });

  it('leaves a page that is never shared untouched', () => {
    const original = render('no-store');

    expect(keepPersonalRenderPrivate(original, true)).toBe(original);
  });

  it('keeps the status and the body', async () => {
    const original = new Response('<p>404</p>', {
      status: 404,
      headers: { 'Cache-Control': SHARED },
    });

    const response = keepPersonalRenderPrivate(original, true);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('<p>404</p>');
  });
});
