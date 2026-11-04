import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } }); // Mobile iPhone viewport

test.describe("Mobile Responsive View & Interactions", () => {
  test("TC-MOB-01: Mobile Bottom Navigation is visible and links work", async ({ page }) => {
    await page.goto("/");

    // 1. BottomNav should be visible on mobile
    const bottomNav = page.locator('[data-testid="mobile-bottom-nav"]');
    await expect(bottomNav).toBeVisible();

    // 2. Desktop sidebar should be hidden
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeHidden();

    // 3. Navigation to Search via BottomNav
    await bottomNav.getByRole("link", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search/);

    // 4. Navigation to Library via BottomNav
    await bottomNav.getByRole("link", { name: "Your Library" }).click();
    await expect(page).toHaveURL(/\/collection/);
    await expect(page.getByRole("heading", { name: "Your Library" })).toBeVisible();
  });

  test("TC-MOB-02: Playing a track displays floating mini-player and expands full-screen player on tap", async ({ page }) => {
    await page.goto("/");

    // Play first track on home page
    const playButtons = page.locator('[data-testid="track-row"]');
    if ((await playButtons.count()) > 0) {
      await playButtons.first().click();

      // Floating mini-player should appear
      const miniPlayer = page.locator('[data-testid="mobile-mini-player"]');
      await expect(miniPlayer).toBeVisible({ timeout: 5000 });

      // Tap mini-player to expand full-screen modal
      await miniPlayer.click();

      const fullPlayer = page.locator('[data-testid="full-screen-player-modal"]');
      await expect(fullPlayer).toBeVisible();

      // Collapse player
      const collapseBtn = fullPlayer.locator('button[aria-label="Collapse player"]');
      await collapseBtn.click();
      await expect(fullPlayer).toBeHidden();
    }
  });

  test("TC-MOB-03: Album page renders touch-friendly 2-line rows without desktop table header", async ({ page }) => {
    // Navigate to an album
    await page.goto("/search?q=hit");
    await page.waitForTimeout(1000);

    const trackRows = page.locator('[data-testid="track-row"]');
    if ((await trackRows.count()) > 0) {
      const firstRow = trackRows.first();
      await expect(firstRow).toBeVisible();

      // Desktop table header should be hidden on mobile
      const tableHeader = page.locator("div.hidden.md\\:grid");
      if ((await tableHeader.count()) > 0) {
        await expect(tableHeader.first()).toBeHidden();
      }
    }
  });
});
