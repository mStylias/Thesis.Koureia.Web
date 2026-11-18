import { randomBytes } from 'node:crypto';

import {
  AuthorizationFlow,
  clearFlowCookieHeader,
  createFlowCookieHeader,
  readFlowCookie,
  sealAuthorizationFlow,
  unsealAuthorizationFlow,
} from './flow-cookie';
import { SessionCookieKeyring } from './session-cookie';

const keyring: SessionCookieKeyring = { current: randomBytes(32) };
const flow: AuthorizationFlow = {
  v: 1,
  cv: 'code-verifier',
  state: 'state',
  nonce: 'nonce',
  returnUrl: '/el/barbershops?near=me',
};

describe('authorization flow cookie', () => {
  it('returns the complete flow after sealing and unsealing', () => {
    const sealed = sealAuthorizationFlow(flow, keyring);

    expect(unsealAuthorizationFlow(sealed, keyring)).toEqual(flow);
  });

  it('rejects altered and cross-key values', () => {
    const sealed = sealAuthorizationFlow(flow, keyring);
    const altered = `${sealed.slice(0, -1)}${sealed.endsWith('A') ? 'B' : 'A'}`;

    expect(unsealAuthorizationFlow(altered, keyring)).toBeNull();
    expect(unsealAuthorizationFlow(sealed, { current: randomBytes(32) })).toBeNull();
  });

  it('decrypts with the previous key', () => {
    const sealed = sealAuthorizationFlow(flow, keyring);

    expect(
      unsealAuthorizationFlow(sealed, {
        current: randomBytes(32),
        previous: keyring.current,
      }),
    ).toEqual(flow);
  });

  it('sets a ten-minute HttpOnly development cookie', () => {
    const sealed = sealAuthorizationFlow(flow, keyring);
    const header = createFlowCookieHeader(sealed, { name: 'ksf', secure: false });

    expect(header).toContain('Max-Age=600');
    expect(header).toContain('Path=/');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).not.toContain('Secure');
  });

  it('sets and clears Secure on the production cookie', () => {
    const config = { name: '__Host-ksf', secure: true } as const;
    const sealed = sealAuthorizationFlow(flow, keyring);

    expect(createFlowCookieHeader(sealed, config)).toContain('Secure');
    expect(clearFlowCookieHeader(config)).toContain('Secure');
    expect(clearFlowCookieHeader(config)).toContain('Max-Age=0');
  });

  it('rejects duplicate flow cookies', () => {
    expect(readFlowCookie('ksf=first; ksf=second', { name: 'ksf', secure: false })).toBeNull();
  });

  it('rejects an external return URL before sealing', () => {
    expect(() =>
      sealAuthorizationFlow({ ...flow, returnUrl: 'https://attacker.example' }, keyring),
    ).toThrow('The authorization flow is invalid.');
  });
});
