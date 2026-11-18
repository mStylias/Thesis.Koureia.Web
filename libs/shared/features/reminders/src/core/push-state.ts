import { environmentState } from './push-environment';
import type { PushState, PushStateInput } from './push-state.types';

/**
 * Derives the push state. A browser that cannot push is `unsupported` before the API answers. An
 * environment without push keys makes every other state `unsupported`, the guides included.
 */
export function derivePushState(input: PushStateInput): PushState {
  if (input.environment === null) return 'unknown';

  const local = environmentState(input.environment);
  if (local === 'unsupported') return 'unsupported';
  if (input.server === 'not-configured') return 'unsupported';
  if (input.server === 'unknown') return 'unknown';
  if (local !== 'push') return local;

  switch (input.permission) {
    case null:
      return 'unknown';
    case 'denied':
      return 'blocked';
    case 'default':
      return 'available';
    case 'granted':
      if (input.subscribed === null) return 'unknown';
      return input.subscribed ? 'on' : 'off';
  }
}
