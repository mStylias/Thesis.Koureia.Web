import { kcSanitize } from 'keycloakify/lib/kcSanitize';

import type { KcContext } from './KcContext';

/**
 * Cleans the message HTML Keycloak hands the theme, before anything renders it.
 *
 * SECURITY: The `.ftl` bridge copies `message.summary` and the field messages raw. The default
 * Keycloakify template binds them through `kcSanitize`, a pipe that only marks HTML as trusted.
 * It renders the message once before a page can turn it off, so a page that hides it does not
 * close the hole. Call this once, on the context the app boots with.
 */
export function sanitizeKcContext(kcContext: KcContext): KcContext {
  const { message, messagesPerField } = kcContext;
  const sanitized: KcContext = {
    ...kcContext,
    messagesPerField: {
      ...messagesPerField,
      get: (fieldName) => kcSanitize(messagesPerField.get(fieldName)),
      getFirstError: (...fieldNames) => kcSanitize(messagesPerField.getFirstError(...fieldNames)),
    },
  };
  return message === undefined
    ? sanitized
    : { ...sanitized, message: { ...message, summary: kcSanitize(message.summary) } };
}
