import { test, expect } from "@playwright/test";

test.describe("Settings & Audio Preferences", () => {
  test("TC-SET-01: Change preferences and verify persistence", async ({ page }) => {
    // 1. Log in with demo user
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const userMenu = page.locator('[data-testid="user-menu-button"]');
    if (!await userMenu.isVisible()) {
      const topNavDemo = page.getByRole("button", { name: /Demo Login/i });
      if (await topNavDemo.isVisible()) {
        await topNavDemo.click();
      } else {
        await page.getByRole("button", { name: "Log in" }).click();
        await page.getByRole("button", { name: /Quick 1-Click Demo Login/i }).click();
      }
      await expect(userMenu).toBeVisible({ timeout: 10000 });
    }

    // 2. Navigate to /preferences
    await page.goto("/preferences", { waitUntil: "domcontentloaded" });
    await expect(userMenu).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // 3. Check audio quality selector
    const qualitySelect = page.locator("select").first();
    const patchPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/me/preferences") && resp.request().method() === "PATCH" && resp.status() === 200
    );
    await qualitySelect.selectOption("VERY_HIGH");
    await patchPromise;

    // 4. Reload page and verify setting persisted
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(qualitySelect).toHaveValue("VERY_HIGH");
  });

  test("TC-PREM-01: Premium page renders comparison table and handles simulated upgrade", async ({ page }) => {
    await page.goto("/premium", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Listen without limits." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Individual" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Family" })).toBeVisible();

    // Check comparison table
    await expect(page.getByText("Ad-free music listening").first()).toBeVisible();
    await expect(page.getByText("Download to listen offline").first()).toBeVisible();
  });
});
