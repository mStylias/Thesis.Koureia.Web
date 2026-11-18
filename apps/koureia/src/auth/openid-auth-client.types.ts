/** What the visitor asked Keycloak for. `update-password` signs in first when there is no session. */
export type AuthorizationKind = 'sign-in' | 'sign-up' | 'update-password';
