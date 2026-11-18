import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { of, switchMap, type Observable } from 'rxjs';
import { toODataResult, toResult, injectSynaxUrl } from '@synax/client';
import { odataQueryString, Result, type HttpError, type ODataPage } from '@synax/client/core';

import type {
  GrantablePermissionResponse,
  RoleODataResponse,
  RoleResponse,
  CreateRoleRequest,
  UpdateRoleRequest,
} from './roles.types';

/** The endpoint's own cap on `$top`, which is why {@link RolesApi.allRoles} pages at all. */
const ROLES_MAX_TOP = 100;

/** The roles of the caller's shop. The API resolves the shop from the signed-in user. */
@Service()
export class RolesApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /**
   * Every role of the company, in one list.
   *
   * The grid over this reads the **client's** name for a seeded role, so it filters, sorts and
   * pages that name rather than the English one stored in the column. Neither is possible
   * server-side: the translation exists nowhere but the client. So the whole collection is
   * fetched once and the grid runs locally over it, which a company's handful of roles affords.
   *
   * Paged, because the endpoint caps `$top` at {@link ROLES_MAX_TOP} and silently returns that
   * many. `$count` is what says whether there is more; a short page ends it either way.
   *
   * No `$select`: the rows feed a local engine rather than three columns, and `isSystem` — which
   * decides whether a name is translated at all — is not a column.
   *
   * The query string is **appended to the URL**. Handing it to `HttpClient`'s `params` would
   * encode it a second time, and the server would search for the literal `%20`.
   */
  allRoles(): Observable<Result<readonly RoleODataResponse[]>> {
    return this.rolesFrom([], 0);
  }

  /** One page of roles, concatenated onto the ones already in hand. */
  private rolesFrom(
    collected: readonly RoleODataResponse[],
    skip: number,
  ): Observable<Result<readonly RoleODataResponse[]>> {
    return this.http
      .get<ODataPage<RoleODataResponse>>(
        this.url('roles/odata') +
          odataQueryString<RoleODataResponse>({ count: true, top: ROLES_MAX_TOP, skip }),
      )
      .pipe(
        toODataResult<RoleODataResponse>(),
        switchMap((result) => {
          if (!result.isSuccess) {
            return of(Result.Fail<HttpError>(result.error));
          }
          const page = result.data;
          const items = page?.items ?? [];
          const rows = [...collected, ...items];
          const exhausted =
            items.length < ROLES_MAX_TOP ||
            (page?.totalCount != null && rows.length >= page.totalCount);
          return exhausted
            ? of(Result.Ok<readonly RoleODataResponse[]>(rows))
            : this.rolesFrom(rows, rows.length);
        }),
      );
  }

  /**
   * Every permission code in the system, annotated for this caller at this company.
   *
   * Ordered by category then code, and complete: a code the caller cannot grant arrives with
   * `canGrant: false` rather than being left out, which is what lets the editor grey it out.
   */
  grantablePermissions(): Observable<Result<readonly GrantablePermissionResponse[]>> {
    return this.http
      .get<readonly GrantablePermissionResponse[]>(this.url('roles/grantable-permissions'))
      .pipe(toResult());
  }

  /**
   * One role with the permission codes it holds.
   *
   * Another company's role is a `404` and not a `403`: the row is filtered away before the
   * handler sees it, so there is nothing to refuse.
   */
  role(roleId: string): Observable<Result<RoleResponse>> {
    return this.http
      .get<RoleResponse>(this.url(`roles/${encodeURIComponent(roleId)}`))
      .pipe(toResult<RoleResponse>());
  }

  /** Creates a company-owned role. Anything created here comes back editable. */
  createRole(request: CreateRoleRequest): Observable<Result<RoleResponse>> {
    return this.http.post<RoleResponse>(this.url('roles'), request).pipe(toResult<RoleResponse>());
  }

  /**
   * Replaces a role.
   *
   * A **full replace and not a patch**: `permissions` is the role's new complete set, so every
   * code that should remain has to be sent, and `name`/`description` go along even when only
   * the permissions changed.
   */
  updateRole(roleId: string, request: UpdateRoleRequest): Observable<Result<RoleResponse>> {
    return this.http
      .put<RoleResponse>(this.url(`roles/${encodeURIComponent(roleId)}`), request)
      .pipe(toResult<RoleResponse>());
  }
}
