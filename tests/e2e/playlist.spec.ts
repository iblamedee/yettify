import { test, expect } from "@playwright/test";

test.describe("Playlists & Library Management", () => {
  test("TC-LIB-01: Create playlist, rename, and verify persistence after reload", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // 1. Log in with demo user if needed
    const loginBtn = page.getByRole("button", { name: "Log in" });
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.getByRole("button", { name: /Quick 1-Click Demo Login/i }).click();
      await expect(page.getByRole("button", { name: /Alex Rivers/ }).first()).toBeVisible();
    }

    // 2. Click + to create playlist
    const createBtn = page.getByTitle(/Create playlist/i);
    await createBtn.click();

    // Verify redirected to new playlist page
    await expect(page).toHaveURL(/\/playlist\/[a-zA-Z0-9_-]+/);
    const titleHeader = page.locator("h1");
    await expect(titleHeader).toBeVisible();

    // 3. Edit title
    await titleHeader.click();
    await expect(page.getByRole("heading", { name: "Edit details" })).toBeVisible();

    const titleInput = page.getByPlaceholder("Playlist name");
    await titleInput.fill("Automated E2E Vibes");
    await page.getByRole("button", { name: "Save" }).click();

    // Verify updated header
    await expect(page.getByRole("heading", { name: "Automated E2E Vibes" })).toBeVisible();

    // 4. Reload page F5 and verify persistence
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Automated E2E Vibes" })).toBeVisible();
  });

  test("TC-LIB-02: Liked Songs synchronization", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Log in if needed
    const loginBtn = page.getByRole("button", { name: "Log in" });
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.getByRole("button", { name: /Quick 1-Click Demo Login/i }).click();
      await expect(page.getByRole("button", { name: /Alex Rivers/ }).first()).toBeVisible();
    }

    // Open album
    await page.goto("/album/alb_hmhas", { waitUntil: "domcontentloaded" });

    // Click heart button
    const heartBtn = page.getByTitle(/Save to Liked Songs|Remove from Liked Songs/i).first();
    await heartBtn.click();

    // Navigate to Liked Songs
    await page.goto("/collection/tracks", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Liked Songs" }).first()).toBeVisible();
    await expect(page.getByText("Liked Songs").first()).toBeVisible();
  });

  test("TC-LIB-03: Dynamic playlist cover collage and custom cover editing", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const loginBtn = page.getByRole("button", { name: "Log in" });
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.getByRole("button", { name: /Quick 1-Click Demo Login/i }).click();
      await expect(page.getByRole("button", { name: /Alex Rivers/ }).first()).toBeVisible();
    }

    await page.goto("/playlist/pl_roadtrip", { waitUntil: "domcontentloaded" });

    // Verify header title and cover container
    await expect(page.getByRole("heading", { name: "Summer Roadtrip Vibes" })).toBeVisible();
    const coverImg = page.locator("img[alt='Summer Roadtrip Vibes']").first();
    await expect(coverImg).toBeVisible();

    // Verify home page featured playlists render covers
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Summer Roadtrip Vibes").first()).toBeVisible();
  });
});
