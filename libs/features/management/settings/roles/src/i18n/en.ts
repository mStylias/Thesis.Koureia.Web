import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  gridLabel: 'Company roles',
  name: 'Name',
  description: 'Description',
  numberOfUsers: 'Users',
  add: 'Add role',
  refresh: 'Refresh',
  // The seeded rows, keyed on `name`. A company's own role names are tenant free text and
  // never read this list.
  roleNames: {
    super_admin: 'Platform super administrator',
    company_admin: 'Owner',
    staff_admin: 'Manager',
    staff_senior: 'Senior staff',
    staff: 'Staff member',
    customer: 'End customer',
  },
  details: {
    new: 'New role',
    actions: 'Role actions',
    edit: 'Edit role',
    cancel: 'Cancel',
    save: 'Save',
    created: 'Role created',
    role: 'Role',
    roleLoading: 'Loading role…',
    updated: 'Role updated',
    grantsNothing: 'This role grants nothing.',
    retry: 'Try again',
    nameRequired: 'Name is required',
    nameTooLong: 'A name can be at most {{max}} characters.',
    permissions: 'Permissions',
    permissionsHint:
      'A role grants only what is ticked here. Greyed out codes are not yours to grant.',
    permissionsLoading: 'Loading permissions…',
    permissionsEmpty: 'There are no permissions to grant.',
    // The catalog is data, so a category the server adds still renders — as its own string.
    categories: {
      members: 'Members',
      services: 'Services',
      staff: 'Staff',
      appointments: 'Appointments',
      customers: 'Customers',
      analytics: 'Analytics',
      users: 'Users',
      roles: 'Roles',
      company: 'Company',
      platform: 'Platform',
    },
    // Keyed on `code`, and every code is here rather than only the grantable ones: the catalog
    // reports a refused code with `canGrant: false` instead of omitting it, so a greyed out row
    // still needs its label. A code the server adds falls back to the English name off the wire.
    codes: {
      'members:read': { name: 'View members', description: 'View company members' },
      'members:invite': { name: 'Invite members', description: 'Add members to a company' },
      'members:remove': { name: 'Remove members', description: 'Remove members from a company' },
      'members:update': {
        name: 'Edit members',
        description: "Edit members' profile, roles and photo",
      },
      'services:read': { name: 'View services', description: 'View services' },
      'services:create': { name: 'Create services', description: 'Create services' },
      'services:update': { name: 'Update services', description: 'Edit services' },
      'services:delete': { name: 'Delete services', description: 'Delete services' },
      'staff:manage_schedule': {
        name: 'Manage schedule',
        description: 'Manage work hours for any member',
      },
      'staff:manage_services': {
        name: 'Manage staff services',
        description: 'Manage which services any member offers',
      },
      'staff:manage_timeoff': {
        name: 'Manage time off',
        description: 'Manage time off for any member',
      },
      'staff:manage_own_schedule': {
        name: 'Manage own schedule',
        description: 'Manage only your own work hours',
      },
      'staff:manage_own_timeoff': {
        name: 'Manage own time off',
        description: 'Manage only your own time off',
      },
      'appointments:read_all': {
        name: 'View all appointments',
        description: 'View all appointments in a company',
      },
      'appointments:create': { name: 'Book appointments', description: 'Book appointments' },
      'appointments:update': { name: 'Update appointments', description: 'Modify appointments' },
      'appointments:cancel': { name: 'Cancel appointments', description: 'Cancel appointments' },
      'analytics:read': {
        name: 'View analytics',
        description: "View the shop's analytics, revenue included",
      },
      'customers:read': {
        name: 'View customers',
        description: "View the shop's customers and their visits",
      },
      'customers:update': {
        name: 'Edit customers',
        description: 'Edit walk-in contact details, customer notes and preferred barbers',
      },
      'customers:block': {
        name: 'Block customers',
        description: 'Block and unblock customers from booking online at the shop',
      },
      'customers:merge': {
        name: 'Merge customers',
        description: 'Merge two walk-ins of the shop into one',
      },
      'customers:export': { name: 'Export customers', description: 'Export the customer list' },
      'users:read': { name: 'View users', description: 'View user profiles' },
      'roles:read': { name: 'View roles', description: 'View roles' },
      'roles:create': { name: 'Create roles', description: 'Create custom roles' },
      'roles:update': { name: 'Update roles', description: 'Edit roles' },
      'roles:delete': { name: 'Delete roles', description: 'Delete roles' },
      'roles:assign': { name: 'Assign roles', description: 'Assign roles to users' },
      'company:update': {
        name: 'Edit company settings',
        description: 'Edit hours, closures, booking rules, logo and photos',
      },
      'platform:manage': {
        name: 'Manage platform',
        description: 'Full platform administration',
      },
    },
  },
};

export default en;
