import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideSynaxApi } from '@synax/client';

import { apiInterceptor } from './api.interceptor';

export interface ApiOptions {
  /** API origin, no trailing path. Empty means same-origin. Per-environment, never a constant. */
  baseUrl: string;
  /** The default version segment for `synaxUrl`. `1` gives `/api/v1/...`. */
  version?: number | string;
  /**
   * Interceptors registered after {@link apiInterceptor}, and thus inside it. They see the raw
   * `HttpErrorResponse`, and what they rethrow becomes an `ApiError` on the way out. A
   * bearer-token interceptor belongs here.
   */
  interceptors?: HttpInterceptorFn[];
}

/**
 * `HttpClient`, the API-scoped interceptor chain, and the base URL `injectSynaxUrl()`
 * builds against.
 *
 * One provider, and not three lines in `app.config.ts`, so nobody can forget the interceptor
 * while `HttpClient` still works. That mistake shows up only at the first error.
 *
 * There is no `withFetch()`. `FetchBackend` is the default from Angular 22, and the feature is
 * deprecated.
 */
export function provideApi(options: ApiOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(withInterceptors([apiInterceptor, ...(options.interceptors ?? [])])),
    provideSynaxApi({ baseUrl: options.baseUrl, defaultVersion: options.version ?? 1 }),
  ]);
}
