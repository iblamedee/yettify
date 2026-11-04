import { test, expect } from "@playwright/test";

test.describe("Authentication & Account Lifecycle", () => {
  test("TC-AUTH-01: Guest view has Sign up and Log in buttons", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
  });

  test("TC-AUTH-02: 1-Click Demo Login authenticates as Alex Rivers", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("button", { name: /Quick 1-Click Demo Login/i }).click();

    // Verify avatar with name Alex Rivers is shown
    await expect(page.getByRole("button", { name: /Alex Rivers/ }).first()).toBeVisible({ timeout: 5000 });
  });

  test("TC-AUTH-03: User Logout clears session", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Log in with demo user
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("button", { name: /Quick 1-Click Demo Login/i }).click();
    const userBtn = page.getByTestId("user-menu-button");
    await expect(userBtn).toBeVisible({ timeout: 5000 });

    // Click profile dropdown and log out
    await userBtn.click();
    const logoutBtn = page.getByTestId("logout-button");
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Verify guest state restored
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});
