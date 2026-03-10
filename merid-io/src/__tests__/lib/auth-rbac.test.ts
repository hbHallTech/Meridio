import { hasRequiredRole } from "@/lib/auth.config";

describe("RBAC route access control (hasRequiredRole)", () => {
  // ─── Admin routes ───

  describe("/admin routes", () => {
    it("ADMIN should access /admin pages", () => {
      expect(hasRequiredRole("/admin/teams", ["ADMIN"])).toBe(true);
    });

    it("SUPER_ADMIN should access /admin pages", () => {
      expect(hasRequiredRole("/admin/teams", ["SUPER_ADMIN"])).toBe(true);
    });

    it("HR should NOT access general /admin pages (e.g. /admin/teams)", () => {
      expect(hasRequiredRole("/admin/teams", ["HR"])).toBe(false);
    });

    it("EMPLOYEE should NOT access /admin pages", () => {
      expect(hasRequiredRole("/admin/teams", ["EMPLOYEE"])).toBe(false);
    });

    it("MANAGER should NOT access /admin pages", () => {
      expect(hasRequiredRole("/admin/offices", ["MANAGER"])).toBe(false);
    });
  });

  // ─── Admin user management routes (HR allowed) ───

  describe("/admin/users routes (HR access)", () => {
    it("HR should access /admin/users", () => {
      expect(hasRequiredRole("/admin/users", ["HR"])).toBe(true);
    });

    it("HR should access /admin/users/user-123", () => {
      expect(hasRequiredRole("/admin/users/user-123", ["HR"])).toBe(true);
    });

    it("ADMIN should access /admin/users", () => {
      expect(hasRequiredRole("/admin/users", ["ADMIN"])).toBe(true);
    });

    it("SUPER_ADMIN should access /admin/users", () => {
      expect(hasRequiredRole("/admin/users", ["SUPER_ADMIN"])).toBe(true);
    });

    it("EMPLOYEE should NOT access /admin/users", () => {
      expect(hasRequiredRole("/admin/users", ["EMPLOYEE"])).toBe(false);
    });

    it("MANAGER should NOT access /admin/users", () => {
      expect(hasRequiredRole("/admin/users", ["MANAGER"])).toBe(false);
    });
  });

  // ─── API admin user routes ───

  describe("/api/admin/users routes", () => {
    it("HR should access /api/admin/users", () => {
      expect(hasRequiredRole("/api/admin/users", ["HR"])).toBe(true);
    });

    it("HR should access /api/admin/users/user-123", () => {
      expect(hasRequiredRole("/api/admin/users/user-123", ["HR"])).toBe(true);
    });

    it("ADMIN should access /api/admin/users", () => {
      expect(hasRequiredRole("/api/admin/users", ["ADMIN"])).toBe(true);
    });

    it("EMPLOYEE should NOT access /api/admin/users", () => {
      expect(hasRequiredRole("/api/admin/users", ["EMPLOYEE"])).toBe(false);
    });
  });

  // ─── API admin routes (non-user) ───

  describe("/api/admin routes (non-user)", () => {
    it("HR should NOT access /api/admin/teams", () => {
      expect(hasRequiredRole("/api/admin/teams", ["HR"])).toBe(false);
    });

    it("ADMIN should access /api/admin/teams", () => {
      expect(hasRequiredRole("/api/admin/teams", ["ADMIN"])).toBe(true);
    });
  });

  // ─── Super admin routes ───

  describe("/super-admin routes", () => {
    it("SUPER_ADMIN should access /super-admin", () => {
      expect(hasRequiredRole("/super-admin", ["SUPER_ADMIN"])).toBe(true);
    });

    it("ADMIN should NOT access /super-admin", () => {
      expect(hasRequiredRole("/super-admin", ["ADMIN"])).toBe(false);
    });

    it("SUPER_ADMIN should access /api/super-admin", () => {
      expect(hasRequiredRole("/api/super-admin/tenants", ["SUPER_ADMIN"])).toBe(true);
    });
  });

  // ─── Manager routes ───

  describe("/manager routes", () => {
    it("MANAGER should access /manager/approvals", () => {
      expect(hasRequiredRole("/manager/approvals", ["MANAGER"])).toBe(true);
    });

    it("ADMIN should access /manager routes", () => {
      expect(hasRequiredRole("/manager/approvals", ["ADMIN"])).toBe(true);
    });

    it("EMPLOYEE should NOT access /manager routes", () => {
      expect(hasRequiredRole("/manager/approvals", ["EMPLOYEE"])).toBe(false);
    });

    it("HR should NOT access /manager routes", () => {
      expect(hasRequiredRole("/manager/approvals", ["HR"])).toBe(false);
    });
  });

  // ─── HR routes ───

  describe("/hr routes", () => {
    it("HR should access /hr pages", () => {
      expect(hasRequiredRole("/hr/dashboard", ["HR"])).toBe(true);
    });

    it("ADMIN should access /hr pages", () => {
      expect(hasRequiredRole("/hr/dashboard", ["ADMIN"])).toBe(true);
    });

    it("EMPLOYEE should NOT access /hr pages", () => {
      expect(hasRequiredRole("/hr/dashboard", ["EMPLOYEE"])).toBe(false);
    });
  });

  // ─── Unrestricted routes ───

  describe("unrestricted routes", () => {
    it("any role should access /dashboard", () => {
      expect(hasRequiredRole("/dashboard", ["EMPLOYEE"])).toBe(true);
    });

    it("any role should access /profile", () => {
      expect(hasRequiredRole("/profile", ["EMPLOYEE"])).toBe(true);
    });

    it("any role should access /api/profile/skills", () => {
      expect(hasRequiredRole("/api/profile/skills", ["EMPLOYEE"])).toBe(true);
    });
  });

  // ─── Multi-role users ───

  describe("multi-role users", () => {
    it("user with both HR and EMPLOYEE should access /admin/users", () => {
      expect(hasRequiredRole("/admin/users", ["EMPLOYEE", "HR"])).toBe(true);
    });

    it("user with both HR and EMPLOYEE should NOT access /admin/teams", () => {
      expect(hasRequiredRole("/admin/teams", ["EMPLOYEE", "HR"])).toBe(false);
    });
  });

  // ─── Route prefix ordering (most specific first) ───

  describe("route prefix ordering", () => {
    it("/admin/users should match HR rule, not general /admin rule", () => {
      expect(hasRequiredRole("/admin/users", ["HR"])).toBe(true);
    });

    it("/admin/offices should match general /admin rule (no HR)", () => {
      expect(hasRequiredRole("/admin/offices", ["HR"])).toBe(false);
    });
  });
});
