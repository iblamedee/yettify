import { test, expect } from "@playwright/test";

test.describe("Music Content Pages", () => {
  test("TC-PAGE-01: Album page renders metadata, tracklist, and duration", async ({ page }) => {
    await page.goto("/album/alb_hmhas");

    // Check title and artist
    await expect(page.getByRole("heading", { name: "HIT ME HARD AND SOFT" })).toBeVisible();
    await expect(page.getByText("Billie Eilish").first()).toBeVisible();

    // Check tracks table rows
    await expect(page.getByText("BIRDS OF A FEATHER")).toBeVisible();
    await expect(page.getByText("LUNCH")).toBeVisible();
    await expect(page.getByText("CHIHIRO")).toBeVisible();

    // Check copyright
    await expect(page.getByText(/Darkroom\/Interscope Records/i)).toBeVisible();
  });

  test("TC-PAGE-02: Artist page renders verified badge, popular tracks, discography, and about", async ({ page }) => {
    await page.goto("/artist/art_billie");

    // Header
    await expect(page.getByRole("heading", { name: "Billie Eilish" })).toBeVisible();
    await expect(page.getByText("Verified Artist")).toBeVisible();
    await expect(page.getByText(/monthly listeners/i).first()).toBeVisible();

    // Popular tracks
    await expect(page.getByRole("heading", { name: "Popular" })).toBeVisible();
    await expect(page.getByText("BIRDS OF A FEATHER")).toBeVisible();

    // Discography & About
    await expect(page.getByRole("heading", { name: "Discography" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  });
});
