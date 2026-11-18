/**
 * Cancellation helpers shared by every control that supersedes an in-flight load.
 * Pure functions over the platform `AbortSignal`, so they stay inside this lib's
 * no-Angular, no-transport rule.
 */

/** The abort reason, normalized to an `Error` so every rejection carries one. */
export function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error
    ? reason
    : new DOMException('The operation was aborted.', 'AbortError');
}

/** Throws the normalized abort reason when the signal is already aborted. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw abortReason(signal);
  }
}

/**
 * A rejected promise when the signal has already aborted, otherwise `null`.
 *
 * For a method typed to return a promise: throwing out of the call instead
 * would escape past `.catch` and break a `Promise.all` over several loads.
 *
 * ```ts
 * load: (request) =>
 *   abortedRejection(request.signal) ?? Promise.resolve(applyLoadRequest(rows, request)),
 * ```
 */
export function abortedRejection(signal: AbortSignal | undefined): Promise<never> | null {
  return signal?.aborted === true ? Promise.reject(abortReason(signal)) : null;
}

/**
 * Rejects as soon as the signal aborts, whether or not the underlying promise
 * ever settles. A source that ignores its signal cannot hold a control open.
 */
export function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}
