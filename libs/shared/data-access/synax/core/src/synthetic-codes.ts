/**
 * The error codes the library itself produces, for a failure with no Synax problem body: the
 * request never reached the server, the client cut it short, or the response made no sense.
 * They keep `HttpError.errorCode` always populated, so a `switch` on it needs no null check. A
 * Synax server never sends these values.
 */
export const SyntheticErrorCodes = {
  /** The request got no HTTP response, from an offline client, a DNS failure or a CORS block. */
  NetworkError: 'NETWORK_ERROR',
  /** A client-side timeout fired, such as an RxJS `timeout()` in the request pipe. */
  Timeout: 'TIMEOUT',
  /** The client aborted the request. */
  Cancelled: 'CANCELLED',
  /** The response arrived but its body did not parse, such as bad JSON on a 2xx. */
  ParseError: 'PARSE_ERROR',
  /** A non-HTTP error the library cannot classify. Only `asHttpError` produces it. */
  Unknown: 'UNKNOWN_ERROR',
} as const;

export type SyntheticErrorCode = (typeof SyntheticErrorCodes)[keyof typeof SyntheticErrorCodes];

/**
 * The fallback code for an error response with no Synax problem body, such as a proxy's HTML
 * error page or an empty body. It gives `HTTP_404`, `HTTP_502` and so on.
 */
export function httpStatusCode(status: number): string {
  return `HTTP_${status}`;
}
