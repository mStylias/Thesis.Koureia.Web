/**
 * Whether a failed profile write is worth trying again on the next page load.
 *
 * `httpCode` is `0` when no response reached us at all — offline, DNS, a blocked preflight. Those
 * say nothing about the request, so the same request can succeed later. A `5xx` is the server
 * admitting fault, which is equally temporary.
 *
 * A `4xx` is the request itself being wrong. Repeating it cannot help, so a caller holding a
 * retry token must spend it rather than keep re-sending.
 */
export function isRetryableWriteFailure(error: unknown): boolean {
  const httpCode = (error as { httpCode?: unknown } | null | undefined)?.httpCode;

  // Not an `ApiError` at all: a bug in our own code, not a round trip that can go better.
  if (typeof httpCode !== 'number') return false;

  return httpCode === 0 || httpCode >= 500;
}
