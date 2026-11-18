import { describe, expect, it } from 'vitest';
import { identityProviderName } from './identity-provider';

describe('identityProviderName', () => {
  it('names the realm provider the way the product writes it', () => {
    expect(identityProviderName('google')).toBe('Google');
  });

  it('capitalizes an alias it does not know, rather than printing a configuration key', () => {
    expect(identityProviderName('facebook')).toBe('Facebook');
    expect(identityProviderName('')).toBe('');
  });
});
