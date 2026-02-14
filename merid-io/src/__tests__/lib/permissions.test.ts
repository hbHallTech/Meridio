import {
  hasRole,
  hasAnyRole,
  hasExactRole,
  hasPermission,
  getPermissions,
} from "@/lib/permissions";

describe("hasRole (hierarchy-based)", () => {
  it("ADMIN should have ADMIN role", () => {
    expect(hasRole(["ADMIN"], "ADMIN")).toBe(true);
  });

  it("ADMIN should have MANAGER role (higher hierarchy)", () => {
    expect(hasRole(["ADMIN"], "MANAGER")).toBe(true);
  });

  it("ADMIN should have EMPLOYEE role", () => {
    expect(hasRole(["ADMIN"], "EMPLOYEE")).toBe(true);
  });

  it("EMPLOYEE should not have MANAGER role", () => {
    expect(hasRole(["EMPLOYEE"], "MANAGER")).toBe(false);
  });

  it("EMPLOYEE should not have ADMIN role", () => {
    expect(hasRole(["EMPLOYEE"], "ADMIN")).toBe(false);
  });

  it("MANAGER should have EMPLOYEE role", () => {
    expect(hasRole(["MANAGER"], "EMPLOYEE")).toBe(true);
  });

  it("HR should have MANAGER role (HR=2 >= MANAGER=1)", () => {
    expect(hasRole(["HR"], "MANAGER")).toBe(true);
  });

  it("user with multiple roles should use highest", () => {
    expect(hasRole(["EMPLOYEE", "MANAGER"], "MANAGER")).toBe(true);
  });
});

describe("hasAnyRole", () => {
  it("should return true when user has one of the listed roles", () => {
    expect(hasAnyRole(["EMPLOYEE"], ["EMPLOYEE", "MANAGER"])).toBe(true);
  });

  it("should return false when user has none of the listed roles", () => {
    expect(hasAnyRole(["EMPLOYEE"], ["MANAGER", "ADMIN"])).toBe(false);
  });

  it("should work with multiple user roles", () => {
    expect(hasAnyRole(["EMPLOYEE", "HR"], ["ADMIN", "HR"])).toBe(true);
  });
});

describe("hasExactRole", () => {
  it("should return true for exact match", () => {
    expect(hasExactRole(["ADMIN", "EMPLOYEE"], "ADMIN")).toBe(true);
  });

  it("should return false if role is not in the array", () => {
    expect(hasExactRole(["EMPLOYEE"], "ADMIN")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("EMPLOYEE can create leave", () => {
    expect(hasPermission(["EMPLOYEE"], "leave:create")).toBe(true);
  });

  it("EMPLOYEE cannot approve leave", () => {
    expect(hasPermission(["EMPLOYEE"], "leave:approve")).toBe(false);
  });

  it("MANAGER can approve leave", () => {
    expect(hasPermission(["MANAGER"], "leave:approve")).toBe(true);
  });

  it("MANAGER can manage teams", () => {
    expect(hasPermission(["MANAGER"], "team:manage")).toBe(true);
  });

  it("HR can read users", () => {
    expect(hasPermission(["HR"], "user:read")).toBe(true);
  });

  it("HR cannot delete users", () => {
    expect(hasPermission(["HR"], "user:delete")).toBe(false);
  });

  it("ADMIN can delete users", () => {
    expect(hasPermission(["ADMIN"], "user:delete")).toBe(true);
  });

  it("ADMIN has admin:access", () => {
    expect(hasPermission(["ADMIN"], "admin:access")).toBe(true);
  });

  it("EMPLOYEE does not have admin:access", () => {
    expect(hasPermission(["EMPLOYEE"], "admin:access")).toBe(false);
  });

  it("multi-role user gets combined permissions", () => {
    // EMPLOYEE can create leave, MANAGER can approve
    expect(hasPermission(["EMPLOYEE", "MANAGER"], "leave:approve")).toBe(true);
    expect(hasPermission(["EMPLOYEE", "MANAGER"], "leave:create")).toBe(true);
  });
});

describe("getPermissions", () => {
  it("should return all EMPLOYEE permissions", () => {
    const perms = getPermissions(["EMPLOYEE"]);
    expect(perms).toContain("leave:create");
    expect(perms).toContain("leave:read");
    expect(perms).toContain("leave:cancel");
    expect(perms).not.toContain("leave:approve");
  });

  it("should merge permissions for multiple roles", () => {
    const perms = getPermissions(["EMPLOYEE", "MANAGER"]);
    expect(perms).toContain("leave:create");
    expect(perms).toContain("leave:approve");
    expect(perms).toContain("team:manage");
  });

  it("ADMIN should have the most permissions", () => {
    const adminPerms = getPermissions(["ADMIN"]);
    const empPerms = getPermissions(["EMPLOYEE"]);
    expect(adminPerms.length).toBeGreaterThan(empPerms.length);
  });

  it("should not have duplicates when roles overlap", () => {
    const perms = getPermissions(["EMPLOYEE", "MANAGER", "HR", "ADMIN"]);
    const unique = new Set(perms);
    expect(perms.length).toBe(unique.size);
  });
});
