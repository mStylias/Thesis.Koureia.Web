/** A role as the OData grid reads it. Members are the endpoint's, camel-cased. */
export interface RoleODataResponse {
  readonly id: string;
  readonly ownerId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly isEditable: boolean;
  readonly numberOfUsers: number;
}

/**
 * One role with the permission codes it holds, from the detail endpoint and from a write.
 *
 * `isEditable` is the server's answer and the only one. Re-deriving it from `isSystem` and
 * `ownerId` disagrees with the write endpoints, which refuse anything else with a `403`.
 */
export interface RoleResponse {
  readonly id: string;
  readonly ownerId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly isEditable: boolean;
  /** The codes the role holds, sorted. Names and categories come from the catalog. */
  readonly permissions: readonly string[];
}

/**
 * One entry of the permission catalog, annotated for this caller at this company.
 *
 * Nothing is omitted from the catalog: a refused code arrives flagged so the editor can grey it
 * out rather than silently shortening the list.
 */
export interface GrantablePermissionResponse {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  /** A flat string. It is the only grouping the catalog carries, so the tree is two levels. */
  readonly category: string;
  /** `false` means no company-owned role may ever hold this code, whoever asks. */
  readonly isTenantGrantable: boolean;
  /** `false` means the above, or that the caller does not hold the code at this company. */
  readonly canGrant: boolean;
}

/** The create body. */
export interface CreateRoleRequest {
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly string[];
}

/** The edit body. Edit is a full replace, so `permissions` is the new complete set. */
export type UpdateRoleRequest = CreateRoleRequest;

/** The name and description the role form edits. The tree owns the permissions. */
export interface RoleFormValue {
  name: string;
  description: string;
}
