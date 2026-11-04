import { test, expect } from "@playwright/test";

test.describe("Spotify Recommendation Engine & Discovery", () => {
  test("TC-REC-01: Playlist Recommendations render and can add tracks to playlist", async ({
    page,
  }) => {
    // Navigate to a playlist
    await page.goto("/playlist/pl_todayshits");

    // Check Recommendations section exists at the bottom
    const main = page.getByRole("main");
    await expect(main.getByText("Recommended")).toBeVisible();
    await expect(main.getByText("Based on what's in this playlist")).toBeVisible();

    // Check Refresh button
    const refreshBtn = main.getByRole("button", { name: "Refresh" });
    await expect(refreshBtn).toBeVisible();

    // Check at least one recommended track is displayed with an Add button
    const addButtons = main.getByRole("button", { name: "Add" });
    await expect(addButtons.first()).toBeVisible();
  });

  test("TC-REC-02: Radio station generation (Song Radio & Artist Radio)", async ({
    page,
  }) => {
    // Navigate to Sabrina Carpenter Artist Radio
    await page.goto("/radio/artist/art_sabrina");

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: /Sabrina Carpenter Radio/i })).toBeVisible();

    // Verify presence of tracks within radio station
    await expect(main.getByText("Espresso").first()).toBeVisible();

    // Verify subtitle mentioning related artists
    await expect(main.getByText(/With .* and more/i)).toBeVisible();
  });

  test("TC-REC-03: Recommendations API returns similar tracks for seeds", async ({
    request,
  }) => {
    const res = await request.get("/api/recommendations?seed_artists=Sabrina+Carpenter&limit=5");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.tracks).toBeDefined();
    expect(data.tracks.length).toBeGreaterThan(0);
    expect(data.tracks[0]).toHaveProperty("audioUrl");
    expect(data.tracks[0]).toHaveProperty("title");
  });
});
