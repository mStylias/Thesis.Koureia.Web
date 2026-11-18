export interface SessionClaims {
  readonly sub?: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly givenName?: string;
  readonly familyName?: string;
  readonly locale?: string;
}

export interface AuthSessionResponse {
  readonly signedIn: boolean;
  readonly claims: SessionClaims | null;
}

/** The sealed session shape passed to a server render. */
export interface AuthRequestSession {
  readonly at: string;
  readonly exp: number;
  readonly sub: string;
  readonly email: string;
  readonly ev: boolean;
  readonly gn: string;
  readonly fn: string;
  readonly loc: string;
}

export interface AuthRequestContext {
  readonly session: AuthRequestSession | null;
}

export function readAuthRequestContext(value: unknown): AuthRequestContext | null {
  if (typeof value !== 'object' || value === null || !('session' in value)) return null;

  const session = value.session;
  if (session === null) return { session: null };
  if (typeof session !== 'object') return null;

  const entry = session as Record<string, unknown>;
  if (
    typeof entry['at'] !== 'string' ||
    typeof entry['exp'] !== 'number' ||
    typeof entry['sub'] !== 'string' ||
    typeof entry['email'] !== 'string' ||
    typeof entry['ev'] !== 'boolean' ||
    typeof entry['gn'] !== 'string' ||
    typeof entry['fn'] !== 'string' ||
    typeof entry['loc'] !== 'string'
  ) {
    return null;
  }

  return { session: entry as unknown as AuthRequestSession };
}
