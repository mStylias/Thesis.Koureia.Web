import type { HttpError } from '@synax/client/core';

/** The other walk-in that already holds the email, from the problem body. `null` otherwise. */
export function emailOwnerOf(error: HttpError): string | null {
  if (error.errorCode !== 'CUSTOMER_EMAIL_USED_BY_WALK_IN') return null;
  const customerId = asRecord(error.raw)?.['customerId'];
  return typeof customerId === 'string' && customerId !== '' ? customerId : null;
}

// `raw` is the body as received: a parsed object, or the JSON text of one.
function asRecord(raw: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}
