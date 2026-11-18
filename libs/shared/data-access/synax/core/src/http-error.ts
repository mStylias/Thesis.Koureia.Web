import { httpStatusCode, SyntheticErrorCodes } from './synthetic-codes';

/** One field-level validation failure. Member names match the .NET `ValidationError` record. */
export interface ValidationError {
  /** Machine-readable rule code, such as `"PARTY_TOO_LARGE"`. */
  code: string;
  /** Human-readable message. */
  description: string;
  /**
   * The request property this error belongs to, camelCased per dotted segment and with
   * indexers kept (`"address.street"`, `"items[2].name"`). It matches the request JSON the
   * client sent. Absent for errors that belong to no single field.
   */
  propertyName?: string;
  /** Optional hierarchical child errors. */
  innerErrors?: ValidationError[];
}

/**
 * The client-side mirror of .NET `HttpError`, rebuilt from the RFC 9457 Problem Details wire
 * format (`title` → `errorCode`, `status` → `httpCode`, `detail` → `description`,
 * `errors` → `validationErrors`).
 */
export interface HttpError {
  /** Machine-readable code (the problem `title`); always populated — synthetic if needed. */
  errorCode: string;
  /** HTTP status code; `0` for failures that never received a response. */
  httpCode: number;
  /** Human-readable description (the problem `detail`). */
  description?: string;
  /** Field-level validation errors (the problem `errors` extension); empty when none. */
  validationErrors: ValidationError[];
  /** ASP.NET-stamped trace id for server-log correlation; absent on synthetic errors. */
  traceId?: string;
  /** The original response body, kept as an escape hatch. */
  raw?: unknown;
}

/**
 * Builds an `HttpError` from an HTTP failure. Pure, so it is usable outside Angular.
 *
 * - Status `0`, meaning no response at all, gives `NETWORK_ERROR`.
 * - A problem-shaped body, an object or JSON string with `title`, `status` or `errors`, is
 *   mapped field by field from the Problem Details contract.
 * - Anything else, such as an HTML error page or an empty body, gives `HTTP_{status}` and
 *   keeps the body in `raw`.
 *
 * CAUTION: Decide sign-in state from `httpCode`, or from the `byStatus` map of
 * `SYNAX_ERROR_MESSAGES`, and not from `errorCode`. A `401` or `403` from the authentication
 * middleware never reaches a Synax handler, so its body is empty and it arrives as `HTTP_401`
 * or `HTTP_403`. The codes `UNAUTHORIZED` and `FORBIDDEN` appear only when a handler itself
 * returned `HttpError.Unauthorized(...)` or `Forbidden(...)`.
 */
export function parseHttpError(status: number, body: unknown): HttpError {
  if (status === 0) {
    return clientSideError(
      SyntheticErrorCodes.NetworkError,
      'The request never received a response.',
      body,
    );
  }

  const problem = asProblemObject(body);
  if (problem) {
    const title =
      typeof problem['title'] === 'string' && problem['title'].length > 0 ? problem['title'] : null;
    return {
      errorCode: title ?? httpStatusCode(status),
      httpCode: status,
      description: typeof problem['detail'] === 'string' ? problem['detail'] : undefined,
      validationErrors: mapValidationErrors(problem['errors']),
      traceId: typeof problem['traceId'] === 'string' ? problem['traceId'] : undefined,
      raw: body,
    };
  }

  return {
    errorCode: httpStatusCode(status),
    httpCode: status,
    validationErrors: [],
    raw: body ?? undefined,
  };
}

/**
 * Builds an `HttpError` for a failure the client itself produced, such as a timeout, a
 * cancellation or a parse failure. `httpCode` defaults to `0` because no server status exists.
 */
export function clientSideError(
  errorCode: string,
  description?: string,
  raw?: unknown,
  httpCode = 0,
): HttpError {
  return { errorCode, httpCode, description, validationErrors: [], raw };
}

/**
 * Flattens the validation-error tree, depth first.
 *
 * An inner `propertyName` is relative to its parent and joins with `.`, so a parent `items[2]`
 * with an inner `name` gives `items[2].name`. An entry with no name keeps the nearest named
 * ancestor's path.
 */
export function flattenValidationErrors(error: HttpError): ValidationError[] {
  const flattened: ValidationError[] = [];
  const visit = (errors: ValidationError[], parentPath?: string): void => {
    for (const entry of errors) {
      const path = joinPropertyPaths(parentPath, entry.propertyName);
      flattened.push({ code: entry.code, description: entry.description, propertyName: path });
      if (entry.innerErrors?.length) visit(entry.innerErrors, path);
    }
  };
  visit(error.validationErrors);
  return flattened;
}

/** The flattened validation errors whose full path equals `propertyPath`. */
export function errorsFor(error: HttpError, propertyPath: string): ValidationError[] {
  return flattenValidationErrors(error).filter((e) => e.propertyName === propertyPath);
}

/** The flattened validation errors that belong to no field (no `propertyName` anywhere). */
export function generalErrors(error: HttpError): ValidationError[] {
  return flattenValidationErrors(error).filter((e) => e.propertyName === undefined);
}

function joinPropertyPaths(parent?: string, child?: string): string | undefined {
  if (!parent) return child;
  if (!child) return parent;
  return `${parent}.${child}`;
}

function asProblemObject(body: unknown): Record<string, unknown> | null {
  let candidate = body;
  if (typeof candidate === 'string') {
    if (candidate.trim().length === 0) return null;
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }
  const obj = candidate as Record<string, unknown>;
  return 'title' in obj || 'status' in obj || 'errors' in obj ? obj : null;
}

function mapValidationErrors(value: unknown): ValidationError[] {
  if (!Array.isArray(value)) return [];
  const mapped: ValidationError[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const inner = mapValidationErrors(raw['innerErrors']);
    mapped.push({
      code: typeof raw['code'] === 'string' ? raw['code'] : '',
      description: typeof raw['description'] === 'string' ? raw['description'] : '',
      propertyName: typeof raw['propertyName'] === 'string' ? raw['propertyName'] : undefined,
      innerErrors: inner.length > 0 ? inner : undefined,
    });
  }
  return mapped;
}
