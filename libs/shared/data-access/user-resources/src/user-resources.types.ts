/**
 * Wire shapes of `/api/v1/users/me/resources`.
 *
 * `value` is opaque: the backend stores the JSON and never reads inside it, so
 * every member of it is the client's own contract.
 */

/** One stored resource. `updatedAt` is `null` until the first change. */
export interface UserResourceResponse<TValue = unknown> {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string | null;
  readonly value: TValue;
  readonly isShared: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

/** One row of `GET /odata`. The same shape as {@link UserResourceResponse}. */
export type UserResourceODataResponse<TValue = unknown> = UserResourceResponse<TValue>;

/** The OData envelope `GET /odata` answers with. */
export interface ResourcePage<TValue> {
  readonly value: readonly UserResourceODataResponse<TValue>[];
}

/** The body of `POST /`. `name` is required and at most 200 characters. */
export interface CreateUserResourceRequest<TValue = unknown> {
  readonly name: string;
  readonly description?: string | null;
  readonly value: TValue;
  readonly isShared?: boolean;
}

/**
 * The body of `PATCH /{id}`.
 *
 * A merge patch: an omitted property is left alone. `value` is replaced whole
 * — there is no deep merge into the stored JSON — so a caller changing one key
 * reads, modifies and writes the whole object.
 */
export type UpdateUserResourceRequest<TValue = unknown> = Partial<
  CreateUserResourceRequest<TValue>
>;
