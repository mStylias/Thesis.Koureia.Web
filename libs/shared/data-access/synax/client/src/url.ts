import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';

/** Base configuration for building Synax endpoint URLs. */
export interface SynaxApiConfig {
  /** The prefix that goes in front of every URL, such as `https://api.example.com`. */
  baseUrl?: string;
  /**
   * The version `synaxUrl` uses when the call site passes none. Write a minor version as a
   * string, `'1.2'`, which mirrors `ApiVersion(1, 2)` and gives the route segment `v1.2`. Both
   * `ApiVersion(1)` and `ApiVersion(1, 0)` give `v1`.
   */
  defaultVersion?: number | string;
}

export const SYNAX_API_CONFIG = new InjectionToken<SynaxApiConfig>('SYNAX_API_CONFIG');

/** Registers the `SYNAX_API_CONFIG` used by `injectSynaxUrl`. */
export function provideSynaxApi(config: SynaxApiConfig): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SYNAX_API_CONFIG, useValue: config }]);
}

export interface SynaxUrlOptions {
  /**
   * The version for the `/api/v{n}/{tag}/...` convention: a number, or a string for a minor
   * version, where `'1.2'` gives `/api/v1.2/...`. Pass `null` to force the unversioned
   * `/{tag}/...` form, such as `/auth/login`, even when a `defaultVersion` is configured.
   */
  version?: number | string | null;
}

/**
 * Builds a URL from the Synax endpoint grouping conventions. A versioned endpoint lives under
 * `/api/v{version}/{tag}/` and an unversioned one under `/{tag}/`. An absolute URL passes
 * through unchanged.
 *
 * ```ts
 * synaxUrl('bookings/restaurant/' + id, { version: 1 })  // /api/v1/bookings/restaurant/{id}
 * synaxUrl('auth/login', { version: null })              // /auth/login
 * ```
 */
export function synaxUrl(
  path: string,
  options: SynaxUrlOptions = {},
  config: SynaxApiConfig = {},
): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;

  const relative = path.replace(/^\/+/, '');
  const version = options.version === undefined ? config.defaultVersion : options.version;
  const prefix = version === null || version === undefined ? '' : `api/v${version}/`;
  const base = config.baseUrl?.replace(/\/+$/, '') ?? '';
  return `${base}/${prefix}${relative}`;
}

/**
 * Returns a `synaxUrl` bound to the configured `SYNAX_API_CONFIG`. The config is optional, and
 * without it the URLs are relative.
 */
export function injectSynaxUrl(): (path: string, options?: SynaxUrlOptions) => string {
  const config = inject(SYNAX_API_CONFIG, { optional: true }) ?? {};
  return (path, options) => synaxUrl(path, options ?? {}, config);
}
