/** The health status of a component. The server serializes its enum as one of these strings. */
export type SynaxHealthStatus = 'Healthy' | 'Degraded' | 'Unhealthy';

/** The result of one health check. The wire shape of `SynaxHealthCheckResult`. */
export interface SynaxHealthCheckResult {
  /** The check's name. */
  name: string;
  /** This check's status. */
  status: SynaxHealthStatus;
  /**
   * Optional detail. A check that threw reports the exception message here. The server sends
   * `null`, and does not omit the member, when the check gave no detail.
   */
  description: string | null;
  /** How long the check took, as a .NET `TimeSpan` string such as `"00:00:00.0123456"`. */
  duration: string;
}

/**
 * The aggregate body of the endpoint that `app.MapSynaxHealthChecks()` maps, `/health` by
 * default.
 *
 * The endpoint answers `200` for `Healthy` and `Degraded`, and `503` for `Unhealthy`, with
 * this same body and not a problem document. A `503` thus reaches the client as an `HttpError`
 * with the synthetic code `HTTP_503` that carries the report in `raw`. Recover it with
 * {@link asHealthReport}.
 */
export interface SynaxHealthCheckResponse {
  /** The worst status across all checks, `Healthy` when there are none. */
  overallStatus: SynaxHealthStatus;
  /** One entry per registered check. The checks run concurrently. */
  checks: SynaxHealthCheckResult[];
  /** Total elapsed time, as a .NET `TimeSpan` string such as `"00:00:00.0123456"`. */
  totalDuration: string;
}

/**
 * Reads a health report out of an unknown value: a success body, or the `raw` of the
 * `HTTP_503` error that an unhealthy report produces.
 *
 * ```ts
 * const report = result.isSuccess
 *   ? result.data
 *   : asHealthReport(result.error.raw);   // 503: unhealthy, but still a report
 * ```
 *
 * Returns `null` when the value is not a health report.
 */
export function asHealthReport(value: unknown): SynaxHealthCheckResponse | null {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return null;

  const obj = candidate as Record<string, unknown>;
  return isStatus(obj['overallStatus']) && Array.isArray(obj['checks'])
    ? (candidate as SynaxHealthCheckResponse)
    : null;
}

function isStatus(value: unknown): value is SynaxHealthStatus {
  return value === 'Healthy' || value === 'Degraded' || value === 'Unhealthy';
}
