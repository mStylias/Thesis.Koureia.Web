/** Work that must finish while the session still holds its access token. See `BEFORE_SIGN_OUT`. */
export type BeforeSignOut = () => Promise<unknown>;
