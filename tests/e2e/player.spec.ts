import { test, expect } from "@playwright/test";

test.describe("Music Player Controls & Shortcuts", () => {
  test("TC-PLAY-01: Play track from album opens bottom player and syncs metadata", async ({ page }) => {
    await page.goto("/album/alb_hmhas", { waitUntil: "networkidle" });

    // Click play on track BIRDS OF A FEATHER
    const playBtn = page.getByLabel(/Play BIRDS OF A FEATHER/i);
    await expect(playBtn).toBeVisible({ timeout: 10000 });
    await playBtn.click();

    // Verify persistent bottom player bar appears
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("BIRDS OF A FEATHER")).toBeVisible();
    await expect(footer.getByText("Billie Eilish")).toBeVisible();
  });

  test("TC-PLAY-02: Spacebar toggles Play and Pause", async ({ page }) => {
    await page.goto("/album/alb_hmhas", { waitUntil: "networkidle" });
    const playBtn = page.getByLabel(/Play BIRDS OF A FEATHER/i);
    await playBtn.click();

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    const playPauseBtn = footer.getByTitle(/(?:Play|Pause) \(Space\)/i);
    await expect(playPauseBtn).toBeVisible({ timeout: 5000 });

    const initialTitle = await playPauseBtn.getAttribute("title");

    // Press Space to toggle
    await page.keyboard.press("Space");

    if (initialTitle?.includes("Pause")) {
      await expect(footer.getByTitle(/Play \(Space\)/i)).toBeVisible({ timeout: 5000 });
    } else {
      await expect(footer.getByTitle(/Pause \(Space\)/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("TC-PLAY-03: Keyboard Shortcuts Cheatsheet modal opens on Ctrl + /", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+/");

    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
    await expect(page.getByText("Playback Controls")).toBeVisible();
    await expect(page.getByText("Next track")).toBeVisible();

    // Close via Esc
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).not.toBeVisible();
  });
});
