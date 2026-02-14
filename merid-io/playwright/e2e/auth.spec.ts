import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    // Should display the login form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should reject invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "bad@halley-technologies.ch");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should stay on login page or show error
    await expect(page).toHaveURL(/\/login/);
  });

  test("should reject non-halley email", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "user@gmail.com");
    await page.fill('input[type="password"]', "test");
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page).toHaveURL(/\/login/);
  });

  test("should login with admin credentials and reach 2FA", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "hbo@halley-technologies.ch");
    await page.fill('input[type="password"]', "ChangeMe2026!");
    await page.click('button[type="submit"]');

    // Should either redirect to 2FA verification or dashboard
    await page.waitForURL(/\/(login\/verify|dashboard|fr|en)/, {
      timeout: 10_000,
    });
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect unauthenticated users from admin pages", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Language switching", () => {
  test("should have French and English locale paths", async ({ page }) => {
    // Default should redirect to /fr
    await page.goto("/");
    // The app should redirect to a locale prefix
    await page.waitForURL(/\/(fr|en|login)/, { timeout: 10_000 });
  });
});
