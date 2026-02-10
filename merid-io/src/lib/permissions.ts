import { UserRole } from "@prisma/client";

export type Role = UserRole;

const roleHierarchy: Record<Role, number> = {
  EMPLOYEE: 0,
  MANAGER: 1,
  HR: 2,
  ADMIN: 3,
};

export function hasRole(userRoles: Role[], requiredRole: Role): boolean {
  return userRoles.some((role) => roleHierarchy[role] >= roleHierarchy[requiredRole]);
}

export function hasAnyRole(userRoles: Role[], roles: Role[]): boolean {
  return userRoles.some((userRole) => roles.includes(userRole));
}

export function hasExactRole(userRoles: Role[], role: Role): boolean {
  return userRoles.includes(role);
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

export function hasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some((role) => rolePermissions[role]?.includes(permission) ?? false);
}

export function getPermissions(roles: Role[]): Permission[] {
  const perms = new Set<Permission>();
  for (const role of roles) {
    for (const p of rolePermissions[role] ?? []) {
      perms.add(p);
    }
  }
  return Array.from(perms);
}
