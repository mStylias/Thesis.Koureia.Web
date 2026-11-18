import { NextFunction, Request, Response } from 'express';

import { SITE_ORIGIN } from './app/site-origin';

// The same origin the `canonical` and `hreflang` tags are written against. One constant,
// because a page whose canonical names a host this redirects away from is self-defeating.
const CANONICAL_ORIGIN = SITE_ORIGIN;
const ALTERNATE_HOST = 'www.koureia.gr';

/** Permanently moves the alternate production hostname before auth or rendering. */
export function redirectToCanonicalHost(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const hosts = [request.get('host'), request.get('x-forwarded-host')].map(readHostname);
  if (!hosts.includes(ALTERNATE_HOST)) {
    next();
    return;
  }

  response.redirect(308, `${CANONICAL_ORIGIN}${request.originalUrl}`);
}

function readHostname(value: string | undefined): string | null {
  const first = value?.split(',', 1)[0]?.trim();
  if (first === undefined || first === '' || !URL.canParse(`http://${first}`)) return null;
  return new URL(`http://${first}`).hostname.toLowerCase();
}
