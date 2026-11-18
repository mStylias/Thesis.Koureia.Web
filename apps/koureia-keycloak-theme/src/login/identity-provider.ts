/** Aliases whose name is not the alias with a capital letter on the front. */
const DISPLAY_NAMES: Record<string, string> = {
  google: 'Google',
};

/**
 * The name to print for an identity provider.
 *
 * Keycloak sends the alias, which is a configuration key rather than a name: the realm's Google
 * provider arrives as `google` and reads as lower case in the middle of a sentence. An unknown
 * alias is capitalized instead of dropped, so a provider added later still names itself.
 */
export function identityProviderName(alias: string): string {
  return DISPLAY_NAMES[alias] ?? alias.charAt(0).toUpperCase() + alias.slice(1);
}
