import { test, expect } from "@playwright/test";

test.describe("Search and Browse Discovery", () => {
  test("TC-SRCH-01: Browse categories grid renders genre tiles", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Browse all" })).toBeVisible();

    // Check Pop, Hip-Hop, Rock tiles
    await expect(page.getByText("Pop", { exact: true })).toBeVisible();
    await expect(page.getByText("Hip-Hop", { exact: true })).toBeVisible();
    await expect(page.getByText("Rock", { exact: true })).toBeVisible();
  });

  test("TC-SRCH-02: Search returns Top Result and songs", async ({ page }) => {
    await page.goto("/search?q=Billie");

    // Top result for Billie Eilish should be present
    await expect(page.getByRole("heading", { name: "Top result" })).toBeVisible();
    await expect(page.getByText("Billie Eilish").first()).toBeVisible();

    // Filter pills within main content
    const main = page.getByRole("main");
    await expect(main.getByRole("button", { name: "Songs", exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "Artists" })).toBeVisible();
    await expect(main.getByRole("button", { name: "Albums" })).toBeVisible();
  });

  test("TC-SRCH-03: Filter by Artists displays artists cards", async ({ page }) => {
    await page.goto("/search?q=Sabrina");
    const main = page.getByRole("main");
    await main.getByRole("button", { name: "Artists" }).click();

    await expect(main.getByRole("heading", { name: "Artists", exact: true })).toBeVisible();
    await expect(main.getByText("Sabrina Carpenter").first()).toBeVisible();
  });

  test("TC-SRCH-04: Clicking a searched track plays audio and syncs bottom player", async ({ page }) => {
    await page.goto("/search?q=birds+of+a+feather");

    // Wait for search results
    await expect(page.getByRole("heading", { name: "Top result" })).toBeVisible();

    // Click on BIRDS OF A FEATHER in the Songs list
    const main = page.getByRole("main");
    const songItem = main.getByText("BIRDS OF A FEATHER").first();
    await songItem.click();

    // Bottom player should now show the track and be playing
    const playerBar = page.getByRole("contentinfo");
    await expect(playerBar.getByText("BIRDS OF A FEATHER")).toBeVisible();
    await expect(playerBar.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("TC-SRCH-05: Multi-source search supports YouTube and Spotify filters and audio streaming", async ({ page }) => {
    await page.goto("/search?q=bohemian+rhapsody");

    // Check that YouTube and Spotify filter pills are visible
    const main = page.getByRole("main");
    await expect(main.getByRole("button", { name: "YouTube" })).toBeVisible();
    await expect(main.getByRole("button", { name: "Spotify" })).toBeVisible();

    // Filter by YouTube
    await main.getByRole("button", { name: "YouTube" }).click();
    await expect(main.getByRole("heading", { name: "YouTube Music & Streams" })).toBeVisible();

    // Verify tracks are rendered
    const rows = main.locator('[data-testid="track-row"]');
    await expect(rows.first()).toBeVisible();

    // Play top track from YouTube
    await rows.first().click();

    // Player bar should open and be playing
    const playerBar = page.getByRole("contentinfo");
    await expect(playerBar.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("TC-SRCH-06: Global search returns accurate artist and singer names without generic fallbacks", async ({ page }) => {
    await page.goto("/search?q=krishnahazar", { waitUntil: "domcontentloaded" });

    // Wait for search songs to render
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Songs" })).toBeVisible({ timeout: 10000 });

    // Verify artist names render Krishnahazar and no "Various Artists"
    await expect(main.getByText("Krishnahazar").first()).toBeVisible();
    await expect(main.getByText("Various Artists")).toHaveCount(0);
  });

  test("TC-SRCH-07: Rapid typing into search bar preserves full text without glitches or dropped letters", async ({ page }) => {
    await page.goto("/search");
    const searchInput = page.getByPlaceholder("What do you want to play?");
    await expect(searchInput).toBeVisible();

    // Focus and rapidly type a query character by character
    await searchInput.click();
    await searchInput.pressSequentially("birds of a feather", { delay: 50 });

    // Assert that the full input string is retained without any swallowed or overwritten letters
    await expect(searchInput).toHaveValue("birds of a feather");

    // Wait for debounce and verify URL is updated smoothly
    await page.waitForURL(/\/search\?q=birds%20of%20a%20feather/);
  });
});
