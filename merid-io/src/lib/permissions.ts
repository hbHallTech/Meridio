export type Role = "EMPLOYEE" | "MANAGER" | "HR" | "ADMIN";

const roleHierarchy: Record<Role, number> = {
  EMPLOYEE: 0,
  MANAGER: 1,
  HR: 2,
  ADMIN: 3,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function hasAnyRole(userRole: Role, roles: Role[]): boolean {
  return roles.some((role) => userRole === role);
}

export type Permission =
  | "leave:create"
  | "leave:read"
  | "leave:approve"
  | "leave:cancel"
  | "user:read"
  | "user:create"
  | "user:update"
  | "user:delete"
  | "team:manage"
  | "report:view"
  | "report:export"
  | "admin:access"
  | "hr:access"
  | "manager:access";

const rolePermissions: Record<Role, Permission[]> = {
  EMPLOYEE: ["leave:create", "leave:read", "leave:cancel"],
  MANAGER: [
    "leave:create",
    "leave:read",
    "leave:approve",
    "leave:cancel",
    "team:manage",
    "report:view",
    "manager:access",
  ],
  HR: [
    "leave:create",
    "leave:read",
    "leave:approve",
    "leave:cancel",
    "user:read",
    "user:create",
    "user:update",
    "report:view",
    "report:export",
    "hr:access",
  ],
  ADMIN: [
    "leave:create",
    "leave:read",
    "leave:approve",
    "leave:cancel",
    "user:read",
    "user:create",
    "user:update",
    "user:delete",
    "team:manage",
    "report:view",
    "report:export",
    "admin:access",
    "hr:access",
    "manager:access",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return rolePermissions[role] ?? [];
}
