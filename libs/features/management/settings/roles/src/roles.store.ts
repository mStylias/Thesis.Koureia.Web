import { Service, computed, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of, shareReplay, tap, type Observable } from 'rxjs';
import { StaffAccessStore } from '@auth/data-access';
import { Result, SyntheticErrorCodes, type HttpError } from '@synax/client/core';

import { RolesApi } from './roles.api';
import type { GrantablePermissionResponse, RoleODataResponse } from './roles.types';

/**
 * The state the roles screen shares between the grid and the panel over it.
 *
 * The panel is a child route, so it cannot reach anything the grid holds — and the grid must
 * still show a role the panel just created. The store is what both address instead. It is
 * `autoProvided: false` and provided by `RolesList`, so each visit starts a new store.
 */
@Service({ autoProvided: false })
export class RolesStore {
  private readonly api = inject(RolesApi);
  private readonly access = inject(StaffAccessStore);

  /** The shop the API reads. A superadmin can change it, so everything held here is keyed on it. */
  private readonly shopId = computed(() => this.access.company()?.id ?? null);

  /** The collection once a fetch has succeeded. `null` means nothing is held. */
  private held: readonly RoleODataResponse[] | null = null;

  /** The shop {@link held} and {@link inFlight} belong to. */
  private heldFor: string | null = null;

  /** The fetch a concurrent caller joins instead of starting a second one. */
  private inFlight: Observable<Result<readonly RoleODataResponse[]>> | null = null;

  private readonly writes = signal(0);

  /** Bumped whenever the held collection is replaced, so the grid re-runs its load. */
  readonly revision = this.writes.asReadonly();

  /**
   * Every role of the company, fetched once and held.
   *
   * The grid over this filters, sorts and pages the **translated** name of a seeded role, and no
   * endpoint can do that — the translation exists nowhere but the client. So the grid runs
   * locally over the whole collection, which is why one filter keystroke must not be one
   * request: every load after the first reads what is held here.
   *
   * A **failure is not held.** The grid's retry is another load, and a cached refusal would
   * answer it with the same refusal for ever.
   */
  roles(): Observable<Result<readonly RoleODataResponse[]>> {
    const shop = untracked(this.shopId);
    if (shop !== this.heldFor) {
      this.held = null;
      this.inFlight = null;
      this.heldFor = shop;
    }
    if (this.held !== null) {
      return of(Result.Ok<readonly RoleODataResponse[]>(this.held));
    }
    this.inFlight ??= this.api.allRoles().pipe(
      tap((result) => {
        this.inFlight = null;
        if (result.isSuccess) {
          this.held = result.data ?? [];
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inFlight;
  }

  /** Drops the held collection, so the next load fetches. */
  reloadRoles(): void {
    this.held = null;
    this.inFlight = null;
    this.writes.update((revision) => revision + 1);
  }

  /** Nothing has asked for the catalog yet, so nothing has been requested. */
  private readonly catalogWanted = signal(false);
  private readonly catalogAttempt = signal(0);

  /**
   * The permission catalog, fetched on first ask and kept for the visit.
   *
   * `params` returning `undefined` is what holds the resource idle: a reader who only looks at
   * the grid never opens the panel, and the catalog is the panel's alone. Reopening the panel
   * reads the same response rather than issuing a second request.
   */
  private readonly catalogResource = rxResource({
    params: () =>
      this.catalogWanted() ? { attempt: this.catalogAttempt(), shop: this.shopId() } : undefined,
    stream: () => this.api.grantablePermissions(),
  });

  /** The catalog, or an empty list while it is loading or has failed. */
  readonly permissions = computed<readonly GrantablePermissionResponse[]>(() => {
    const result = this.catalogResource.value();
    return result?.isSuccess ? (result.data ?? []) : [];
  });

  readonly permissionsLoading = computed(() => this.catalogResource.isLoading());

  /**
   * Why the catalog is not here, or `null` while it is or is still loading.
   *
   * A refusal arrives as data rather than as a thrown error, so a failed `Result` is the case
   * to read. `error()` covers only a request that produced no result at all, which carries no
   * problem document to read a code from.
   */
  readonly permissionsError = computed<HttpError | null>(() => {
    if (this.catalogResource.isLoading()) return null;
    const result = this.catalogResource.value();
    if (result === undefined) {
      return this.catalogResource.error() === undefined ? null : UNREACHABLE;
    }
    return result.isFailure ? result.error : null;
  });

  /** Asks for the catalog. Repeated calls are free; the response is already held. */
  requestPermissions(): void {
    this.catalogWanted.set(true);
  }

  /** Re-requests a catalog that failed. */
  reloadPermissions(): void {
    this.catalogWanted.set(true);
    this.catalogAttempt.update((attempt) => attempt + 1);
  }

  /** Announces a written role to the grid, which cannot see the panel that wrote it. */
  roleWritten(): void {
    this.reloadRoles();
  }
}

/** Stands in when the request produced no result at all, so there is no problem document. */
const UNREACHABLE: HttpError = {
  errorCode: SyntheticErrorCodes.Unknown,
  httpCode: 0,
  validationErrors: [],
};
