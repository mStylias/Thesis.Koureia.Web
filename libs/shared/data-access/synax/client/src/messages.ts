import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import { HttpError } from '@synax/client/core';

/** A user-facing message: a fixed string, or a function of the error for interpolation. */
export type ErrorMessage = string | ((error: HttpError) => string);

/**
 * The app's `errorCode` to message registry. The library ships no entries. The app maps every
 * code, including the synthetic client-side ones. A value can come from any i18n layer.
 */
export interface SynaxErrorMessages {
  /** Messages keyed by `HttpError.errorCode`. This is the most specific match. */
  codes?: Record<string, ErrorMessage>;
  /** Fallback messages keyed by HTTP status code. */
  byStatus?: Record<number, ErrorMessage>;
  /** The last fallback before the built-in `description ?? errorCode`. */
  fallback?: ErrorMessage;
}

export const SYNAX_ERROR_MESSAGES = new InjectionToken<SynaxErrorMessages>('SYNAX_ERROR_MESSAGES');

/** Registers the `SYNAX_ERROR_MESSAGES` used by `injectErrorMessageResolver`. */
export function provideSynaxErrorMessages(messages: SynaxErrorMessages): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SYNAX_ERROR_MESSAGES, useValue: messages }]);
}

/**
 * Resolves a user-facing message for an error. It tries `errorCode`, then the status, then the
 * registry fallback, then the error's `description`, then the `errorCode` itself.
 */
export function resolveMessage(error: HttpError, messages: SynaxErrorMessages = {}): string {
  const resolved =
    messages.codes?.[error.errorCode] ?? messages.byStatus?.[error.httpCode] ?? messages.fallback;
  if (resolved !== undefined) {
    return typeof resolved === 'string' ? resolved : resolved(error);
  }
  return error.description ?? error.errorCode;
}

/** Returns a `resolveMessage` bound to the configured registry. The registry is optional. */
export function injectErrorMessageResolver(): (error: HttpError) => string {
  const messages = inject(SYNAX_ERROR_MESSAGES, { optional: true }) ?? {};
  return (error) => resolveMessage(error, messages);
}
