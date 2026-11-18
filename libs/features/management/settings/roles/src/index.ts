export { loadRolesDictionaries, rolesRoute } from './roles.routes';
export { rolesInlineLoader, rolesTranslocoScope } from './roles.i18n';
export { categoryLabel, permissionDescription, permissionLabel, roleLabel } from './roles.labels';
export { RolesList } from './list/roles-list';
export { RoleDetails } from './details/role-details';
export { RolesStore } from './roles.store';
export type {
  GrantablePermissionResponse,
  RoleFormValue,
  RoleODataResponse,
  RoleResponse,
  CreateRoleRequest,
  UpdateRoleRequest,
} from './roles.types';
