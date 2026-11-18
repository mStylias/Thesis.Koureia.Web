import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { REDIRECT_SECONDS, describeOutcome, isFinished, resolveLink } from './info.logic';

const BASE = {
  skipLink: false,
  pageRedirectUri: undefined,
  actionUri: undefined,
  clientBaseUrl: undefined,
  appHome: 'https://koureia.gr/el/',
};

describe('REDIRECT_SECONDS', () => {
  it('gives the visitor five seconds to read the outcome', () => {
    expect(REDIRECT_SECONDS).toBe(5);
  });
});

describe('isFinished', () => {
  it('treats only a success as finished', () => {
    expect(isFinished('success')).toBe(true);
    expect(isFinished('info')).toBe(false);
    expect(isFinished('warning')).toBe(false);
    expect(isFinished('error')).toBe(false);
  });
});

describe('describeOutcome', () => {
  it('leaves an outcome that names itself alone', () => {
    expect(describeOutcome('Your account has been updated.', [])).toBe(
      'Your account has been updated.',
    );
  });

  it('names the actions still pending, which the summary does not', () => {
    // Keycloak's `info.ftl` does this. Without it the flow asks for actions it never lists.
    expect(describeOutcome('Please perform the following action(s)', ['Update Password'])).toBe(
      'Please perform the following action(s): Update Password',
    );
    expect(
      describeOutcome('Please perform the following action(s)', [
        'Update Password',
        'Verify Email',
      ]),
    ).toBe('Please perform the following action(s): Update Password, Verify Email');
  });
});

describe('resolveLink', () => {
  it('sends a finished flow home, whatever Keycloak suggests', () => {
    // `actionUri` means more work waits elsewhere. Do not send anybody there five seconds
    // after the page says they finished.
    expect(
      resolveLink({
        ...BASE,
        finished: true,
        actionUri: 'https://keycloak/continue',
        pageRedirectUri: 'https://elsewhere/',
      }),
    ).toEqual({ href: 'https://koureia.gr/el/', labelKey: 'goToHome' });
  });

  it('offers a finished flow its link even when Keycloak asked for none', () => {
    expect(resolveLink({ ...BASE, finished: true, skipLink: true })).toEqual({
      href: 'https://koureia.gr/el/',
      labelKey: 'goToHome',
    });
  });

  it('prefers the page redirect for an unfinished flow', () => {
    expect(
      resolveLink({
        ...BASE,
        finished: false,
        pageRedirectUri: 'https://app/back',
        clientBaseUrl: 'https://app/',
      }),
    ).toEqual({ href: 'https://app/back', labelKey: 'backToApplication' });
  });

  it('labels an action to continue as such', () => {
    expect(
      resolveLink({ ...BASE, finished: false, actionUri: 'https://keycloak/continue' }),
    ).toEqual({ href: 'https://keycloak/continue', labelKey: 'proceedWithAction' });
  });

  it('falls back to the client and then to home', () => {
    expect(resolveLink({ ...BASE, finished: false, clientBaseUrl: 'https://app/' })).toEqual({
      href: 'https://app/',
      labelKey: 'backToApplication',
    });
    expect(resolveLink({ ...BASE, finished: false })).toEqual({
      href: 'https://koureia.gr/el/',
      labelKey: 'goToHome',
    });
  });

  it('honours skipLink when the flow is not finished', () => {
    expect(resolveLink({ ...BASE, finished: false, skipLink: true })).toBeUndefined();
  });
});
