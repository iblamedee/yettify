import { test, expect } from "@playwright/test";

test.describe("Audio Quality Tier Badges", () => {
  test("Desktop player bar displays quality badge for playing track", async ({ page }) => {
    await page.goto("/album/alb_hmhas", { waitUntil: "networkidle" });

    // Click play on track BIRDS OF A FEATHER
    const playBtn = page.getByLabel(/Play BIRDS OF A FEATHER/i);
    await expect(playBtn).toBeVisible({ timeout: 10000 });
    await playBtn.click();

    // Verify desktop quality badge is visible with expected tier
    const badge = page.getByTestId("desktop-quality-badge");
    await expect(badge).toBeVisible({ timeout: 10000 });
    const text = await badge.innerText();
    expect(["ULTRA HD", "HD", "SD"]).toContain(text.trim());
  });

  test("Mobile view displays quality badge in mini-player and full-screen player", async ({ browser }) => {
    // Launch mobile context (iPhone viewport)
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto("/album/alb_hmhas", { waitUntil: "networkidle" });

    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 10000 });
    await trackRow.click();

    // Mobile mini-player badge
    const miniBadge = page.getByTestId("mobile-mini-quality-badge");
    await expect(miniBadge).toBeVisible({ timeout: 10000 });
    const miniText = await miniBadge.innerText();
    expect(["ULTRA HD", "HD", "SD"]).toContain(miniText.trim());

    // Tap mini player to open full-screen modal
    const miniPlayer = page.getByTestId("mobile-mini-player");
    await miniPlayer.click();

    // Full-screen modal badge
    const fullBadge = page.getByTestId("fullscreen-quality-badge");
    await expect(fullBadge).toBeVisible({ timeout: 10000 });
    const fullText = await fullBadge.innerText();
    expect(["ULTRA HD", "HD", "SD"]).toContain(fullText.trim());

    await context.close();
  });
});
