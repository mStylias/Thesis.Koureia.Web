/** How long the success page waits before it returns the visitor to the site. */
export const REDIRECT_SECONDS = 5;

export type MessageType = 'success' | 'warning' | 'error' | 'info';

/** Where the page can send the visitor, and which label says so. */
export interface InfoLink {
  readonly href: string;
  readonly labelKey: 'goToHome' | 'backToApplication' | 'proceedWithAction';
}

/**
 * Whether this outcome is finished and safe to leave on a timer.
 *
 * `info.ftl` serves every informational end state, not only this one. The others ask the
 * visitor to do something next or report a problem, and a timer that moves the page is how such
 * a message goes unread.
 */
export function isFinished(type: MessageType): boolean {
  return type === 'success';
}

/**
 * The sentence under the heading, with the pending actions named.
 *
 * Keycloak sends a summary that omits them, so the administrator-triggered mail arrives asking
 * for actions it never lists. Takes translated names, which keeps this a pure join.
 */
export function describeOutcome(summary: string, requiredActions: readonly string[]): string {
  return requiredActions.length === 0 ? summary : `${summary}: ${requiredActions.join(', ')}`;
}

/**
 * Where the page offers to go, and whether a timer can take it there.
 *
 * A finished flow always goes to the site home page. `pageRedirectUri` and `actionUri` are
 * deliberately unused there, because `actionUri` means more work waits elsewhere and nobody
 * asked to go there. Both still appear as a link on the outcomes that are not finished.
 */
export function resolveLink(params: {
  finished: boolean;
  skipLink: boolean;
  pageRedirectUri: string | undefined;
  actionUri: string | undefined;
  clientBaseUrl: string | undefined;
  appHome: string;
}): InfoLink | undefined {
  if (params.finished) return { href: params.appHome, labelKey: 'goToHome' };
  if (params.skipLink) return undefined;

  if (params.pageRedirectUri !== undefined) {
    return { href: params.pageRedirectUri, labelKey: 'backToApplication' };
  }
  if (params.actionUri !== undefined) {
    return { href: params.actionUri, labelKey: 'proceedWithAction' };
  }
  if (params.clientBaseUrl !== undefined) {
    return { href: params.clientBaseUrl, labelKey: 'backToApplication' };
  }

  return { href: params.appHome, labelKey: 'goToHome' };
}
