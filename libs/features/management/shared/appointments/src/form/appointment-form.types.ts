import type { CustomerOptionODataResponse } from '@api/appointments';

/** What a walk-in's details are looked up by. An email outranks a phone. */
export interface DuplicateLookup {
  readonly kind: 'email' | 'phone';
  /** The email as typed, or the phone's digits. */
  readonly value: string;
}

/**
 * A shop customer with the walk-in's email or phone. An email match is the one the API books for
 * instead of creating the walk-in. A phone match is only a hint.
 */
export interface DuplicateCustomer {
  readonly kind: DuplicateLookup['kind'];
  readonly customer: CustomerOptionODataResponse;
}
