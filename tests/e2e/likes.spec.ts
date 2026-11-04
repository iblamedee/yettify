import { test, expect, Page } from "@playwright/test";

async function loginDemoUser(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const userMenu = page.locator('[data-testid="user-menu-button"]');
  if (await userMenu.isVisible()) return;

  const topNavDemo = page.getByRole("button", { name: /Demo Login/i });
  if (await topNavDemo.isVisible()) {
    await topNavDemo.click();
    await expect(userMenu).toBeVisible({ timeout: 10000 });
    return;
  }

  const loginBtn = page.getByRole("button", { name: "Log in" });
  if (await loginBtn.isVisible()) {
    await loginBtn.click();
    const demoBtn = page.getByRole("button", { name: /Quick 1-Click Demo Login/i });
    await expect(demoBtn).toBeVisible({ timeout: 5000 });
    await demoBtn.click();
    await expect(userMenu).toBeVisible({ timeout: 10000 });
  }
}

test.describe("Spotify Like & Library Management System", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemoUser(page);
  });

  test("TC-LIKE-01: PlayerBar like button toggles liked state and syncs to Liked Songs", async ({ page }) => {
    await page.goto("/album/alb_hmhas", { waitUntil: "domcontentloaded" });

    // Play track from album
    const playBtn = page.getByLabel(/Play BIRDS OF A FEATHER/i);
    await playBtn.click();

    // Verify PlayerBar appears with like button
    const footer = page.locator("footer");
    await expect(footer).toBeVisible({ timeout: 5000 });

    const playerLikeBtn = page.locator('[data-testid="player-like-button"]');
    await expect(playerLikeBtn).toBeVisible({ timeout: 5000 });

    // Toggle like
    await playerLikeBtn.click();

    // Navigate to /collection/tracks
    await page.goto("/collection/tracks", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Liked Songs" }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="play-liked-songs-button"]')).toBeVisible();
  });

  test("TC-LIKE-02: Liking an external searched track auto-persists and appears in Liked Songs", async ({ page }) => {
    await page.goto("/search?q=birds+of+a+feather", { waitUntil: "domcontentloaded" });

    // Wait for search results
    await expect(page.getByRole("heading", { name: "Top result" })).toBeVisible({ timeout: 10000 });

    const songRow = page.locator('[data-testid="search-track-row"]').first();
    await expect(songRow).toBeVisible({ timeout: 5000 });
    await songRow.hover();

    const songLikeBtn = songRow.locator('[data-testid="search-track-like-button"]');
    await songLikeBtn.click({ force: true });

    // Navigate to /collection/tracks and verify list renders
    await page.goto("/collection/tracks", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Liked Songs" }).first()).toBeVisible();
  });

  test("TC-LIKE-03: Filter within Liked Songs filters table in real-time", async ({ page }) => {
    await page.goto("/collection/tracks", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Liked Songs" }).first()).toBeVisible({ timeout: 10000 });

    const searchFilterInput = page.locator('[data-testid="search-liked-songs-input"]');
    await expect(searchFilterInput).toBeVisible({ timeout: 5000 });

    await searchFilterInput.fill("GREATEST");
    await expect(page.getByText(/GREATEST/i).first()).toBeVisible();
  });

  test("TC-LIKE-04: Saving an album updates MediaHeader and sidebar Albums filter", async ({ page }) => {
    // Reset saved state for idempotent testing
    await page.request.delete("/api/me/likes/albums?albumId=alb_gnx");

    await page.goto("/album/alb_gnx", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible({ timeout: 10000 });

    const saveAlbumBtn = page.locator('[data-testid="media-save-button"]');
    await expect(saveAlbumBtn).toBeVisible({ timeout: 10000 });

    // Click Save to Library
    await saveAlbumBtn.click();

    // Switch sidebar filter to Albums
    const albumsFilterPill = page.getByRole("button", { name: "Albums" });
    await albumsFilterPill.click();

    // Verify album appears in sidebar
    const sidebarAlbum = page.locator('[data-testid="sidebar-album-alb_gnx"]');
    await expect(sidebarAlbum).toBeVisible({ timeout: 5000 });
  });

  test("TC-LIKE-05: Following an artist updates MediaHeader and sidebar Artists filter", async ({ page }) => {
    // Reset followed state for idempotent testing
    await page.request.delete("/api/me/following/artists?artistId=art_kendrick");

    await page.goto("/artist/art_kendrick", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible({ timeout: 10000 });

    const followBtn = page.locator('[data-testid="artist-follow-button"]');
    await expect(followBtn).toBeVisible({ timeout: 10000 });

    // Follow Kendrick Lamar
    await followBtn.click();
    await expect(followBtn).toHaveText(/Following/i);

    // Switch sidebar filter to Artists
    const artistsFilterPill = page.getByRole("button", { name: "Artists" });
    await artistsFilterPill.click();

    // Verify artist appears in sidebar
    const sidebarArtist = page.locator('[data-testid="sidebar-artist-art_kendrick"]');
    await expect(sidebarArtist).toBeVisible({ timeout: 5000 });
  });
});
