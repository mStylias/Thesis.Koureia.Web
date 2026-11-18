import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { injectSynaxUrl } from '@synax/client';
import type {
  CreateUserResourceRequest,
  ResourcePage,
  UpdateUserResourceRequest,
  UserResourceODataResponse,
  UserResourceResponse,
} from './user-resources.types';

/**
 * Escapes a string for an OData literal. A single quote is doubled; nothing
 * else in a name can end the literal.
 */
function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Per-user JSON storage.
 *
 * Rows belong to the signed-in user, not to a company, and the user comes from
 * the token — no `userId` is sent. A row belonging to somebody else answers
 * `404`, indistinguishable from one that never existed, so nothing here treats
 * the two apart.
 *
 * ```ts
 * const resource = await firstValueFrom(api.findByName<Layout>('bookings_grid_views'));
 * ```
 *
 * **Names are not unique.** {@link findByName} takes the oldest match so that
 * two sessions racing a create still converge on one row; key everything else
 * on `id`.
 */
@Service()
export class UserResourcesApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  private endpoint(path = ''): string {
    return this.url(`users/me/resources${path}`);
  }

  /** Every resource of the signed-in user, ordered by name. */
  list<TValue = unknown>(): Observable<readonly UserResourceResponse<TValue>[]> {
    return this.http.get<readonly UserResourceResponse<TValue>[]>(this.endpoint());
  }

  /**
   * The oldest resource stored under `name`, or `null` when there is none.
   *
   * The query string is appended to the URL rather than handed to `HttpClient`
   * as `params`: those would encode it a second time and the server would
   * search for the literal `%20`.
   */
  findByName<TValue = unknown>(name: string): Observable<UserResourceODataResponse<TValue> | null> {
    const query = `?$filter=name eq ${odataString(name)}&$orderby=createdAt&$top=1`;
    return this.http
      .get<ResourcePage<TValue>>(this.endpoint('/odata') + query)
      .pipe(map((page) => page.value[0] ?? null));
  }

  get<TValue = unknown>(id: string): Observable<UserResourceResponse<TValue>> {
    return this.http.get<UserResourceResponse<TValue>>(this.endpoint(`/${id}`));
  }

  create<TValue = unknown>(
    body: CreateUserResourceRequest<TValue>,
  ): Observable<UserResourceResponse<TValue>> {
    return this.http.post<UserResourceResponse<TValue>>(this.endpoint(), body);
  }

  /** Merge patch: an omitted property is left alone, `value` is replaced whole. */
  patch<TValue = unknown>(
    id: string,
    body: UpdateUserResourceRequest<TValue>,
  ): Observable<UserResourceResponse<TValue>> {
    return this.http.patch<UserResourceResponse<TValue>>(this.endpoint(`/${id}`), body);
  }

  /**
   * Soft delete. The row stops existing as far as the API is concerned.
   *
   * `unknown` rather than `void`: the endpoint answers `204` with no body, and
   * a `void` type argument is what `no-invalid-void-type` refuses.
   */
  remove(id: string): Observable<unknown> {
    return this.http.delete(this.endpoint(`/${id}`));
  }
}
