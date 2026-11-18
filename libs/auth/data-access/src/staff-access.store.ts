import { HttpClient } from '@angular/common/http';
import { Service, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { injectSynaxUrl } from '@synax/client';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from './session-store';
import type {
  CurrentUserWorkspaceResponse,
  WorkspaceCompanyViewDto,
  WorkspaceStaffMemberViewDto,
} from './staff-access.types';

/** Denies everything. What a failed or unresolved read answers with. */
const NO_ACCESS: CurrentUserWorkspaceResponse = {
  company: null,
  permissions: [],
  isPlatformAdmin: false,
  staff: [],
};

/**
 * Whether the signed-in person is staff, and what they may do at their shop.
 *
 * **Permissions are never in the token.** The API resolves them per request from its own tables,
 * so revocation is immediate. One call, `users/me/workspace`, answers with the shop, the codes
 * there and the superadmin flag. A plain customer's correct answer is no shop, not a refusal.
 *
 * The API picks the shop from the account. A superadmin names one through `X-Company-Id`, which
 * `companyScopeInterceptor` adds, so this store never handles a shop id itself.
 *
 * A read that fails denies rather than grants, and is **not** cached, so a network blip does not
 * lock a barber out until they reload. An unverified email address is one such failure: the API
 * refuses every endpoint until the address is proven.
 */
@Service()
export class StaffAccessStore {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();
  private readonly session = inject(SessionStore);

  private readonly state = signal<CurrentUserWorkspaceResponse | null>(null);

  /** The read in flight, so concurrent guards on one navigation share one call. */
  private pending: Promise<CurrentUserWorkspaceResponse> | null = null;

  /** Increments on each read and on sign-out, so a stale answer cannot overwrite a newer one. */
  private generation = 0;

  /** The shop every company-scoped screen reads. Null when the caller works at none. */
  readonly company = computed<WorkspaceCompanyViewDto | null>(() => this.state()?.company ?? null);

  readonly isPlatformAdmin = computed(() => this.state()?.isPlatformAdmin ?? false);

  /** Every staff member at {@link company}, inactive included, by display name. */
  readonly staff = computed<readonly WorkspaceStaffMemberViewDto[]>(
    () => this.state()?.staff ?? [],
  );

  /**
   * Whether the caller is anything but a plain customer. The workspace gate.
   *
   * A superadmin passes with no shop. The pages then show their own empty states until one is
   * picked.
   */
  readonly canOpenWorkspace = computed(() => this.isPlatformAdmin() || this.company() !== null);

  constructor() {
    // The answer belongs to one account. Dropping it on sign-out stops the next person in this
    // tab from being handed the last one's permissions.
    // Not on `deciding`: a guard's read can already wait on the session then, and a new
    // generation would discard its answer.
    effect(() => {
      const status = this.session.status();
      if (status === 'signed-in' || status === 'deciding') return;
      this.state.set(null);
      this.pending = null;
      this.generation++;
    });
  }

  /**
   * Whether the caller holds a code at {@link company}.
   *
   * A platform administrator holds everything. The API bypasses every requirement for them
   * rather than listing the codes, so it is answered here and not looked up.
   */
  has(permission: string): boolean {
    if (this.isPlatformAdmin()) return true;
    return this.state()?.permissions.includes(permission) ?? false;
  }

  /**
   * Resolves the access state once and caches it. Awaited by the workspace guards, which run
   * before any resolver, so nothing else has had a chance to load it.
   */
  async resolve(): Promise<CurrentUserWorkspaceResponse> {
    const resolved = this.state();
    if (resolved !== null) return resolved;

    this.pending ??= this.read();
    return this.pending;
  }

  /**
   * Reads the workspace again, past the cache. Call it after the superadmin picks a shop.
   *
   * The old answer stays until the new one arrives, so the sidebar does not empty for the length
   * of the call.
   */
  reload(): Promise<CurrentUserWorkspaceResponse> {
    this.pending = this.read();
    return this.pending;
  }

  private async read(): Promise<CurrentUserWorkspaceResponse> {
    const generation = ++this.generation;
    const current = (): boolean => generation === this.generation;

    await this.session.whenReady();
    if (!this.session.isSignedIn()) {
      if (current()) this.pending = null;
      return NO_ACCESS;
    }

    try {
      const body = await firstValueFrom(this.http.get<unknown>(this.url('users/me/workspace')));
      const workspace = readWorkspace(body);
      if (current()) this.state.set(workspace);
      return workspace;
    } catch (error) {
      if (isDevMode()) console.error('[auth] could not resolve workspace access', error);
      // Denies rather than keep a stale answer: after a shop change, the old one grants the
      // permissions of the wrong shop.
      if (current()) this.state.set(null);
      return NO_ACCESS;
    } finally {
      // Cleared either way: on success `state` answers from now on, and on failure the next
      // navigation must be free to try again.
      if (current()) this.pending = null;
    }
  }
}

/** Drops any part the endpoint's shape does not cover, rather than trusting a partial one. */
function readWorkspace(value: unknown): CurrentUserWorkspaceResponse {
  if (typeof value !== 'object' || value === null) return NO_ACCESS;
  const body = value as Record<string, unknown>;

  return {
    company: readCompany(body['company']),
    permissions: readPermissions(body['permissions']),
    isPlatformAdmin: body['isPlatformAdmin'] === true,
    staff: readStaff(body['staff']),
  };
}

function readCompany(value: unknown): WorkspaceCompanyViewDto | null {
  if (typeof value !== 'object' || value === null) return null;
  const company = value as Record<string, unknown>;

  const id = company['id'];
  const name = company['name'];
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  const timezone = company['timezone'];

  return { id, name, timezone: typeof timezone === 'string' && timezone !== '' ? timezone : null };
}

function readPermissions(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((code: unknown): code is string => typeof code === 'string');
}

/** Empty for an API image that does not send the list yet. */
function readStaff(value: unknown): readonly WorkspaceStaffMemberViewDto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    const member = readStaffMember(entry);
    return member === null ? [] : [member];
  });
}

function readStaffMember(value: unknown): WorkspaceStaffMemberViewDto | null {
  if (typeof value !== 'object' || value === null) return null;
  const member = value as Record<string, unknown>;

  const id = member['id'];
  const displayName = member['displayName'];
  const isActive = member['isActive'];
  if (typeof id !== 'string' || typeof displayName !== 'string' || typeof isActive !== 'boolean') {
    return null;
  }

  return { id, displayName, isActive };
}
