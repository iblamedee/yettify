import { test, expect } from "@playwright/test";

test.describe("Streaming Resolution & Audio Accuracy", () => {
  test("TC-STRM-01: /api/stream resolves studio CDN audio for verified tracks", async ({ request }) => {
    const res = await request.get("/api/stream?title=Chal%20Bombay&artist=DIVINE&format=json");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.audioUrl).toBeDefined();
    expect(data.audioUrl).toContain("http");
  });

  test("TC-STRM-02: /api/stream handles YouTube stream requests gracefully", async ({ request }) => {
    const res = await request.get("/api/stream?ytId=9EW96Escn38&format=json");
    // Should return either 200 with audioUrl or 404 with structured error (never crash 500)
    expect([200, 404]).toContain(res.status());
    const data = await res.json();
    expect(data.source).toBe("youtube");
  });

  test("TC-STRM-03: Searching an artist prioritizes tracks by that artist", async ({ page }) => {
    await page.goto("/search?q=DIVINE");

    // Wait for search results
    await expect(page.getByRole("heading", { name: "Top result" })).toBeVisible({ timeout: 10000 });
    const main = page.getByRole("main");
    await expect(main.getByText("DIVINE").first()).toBeVisible();
    await expect(main.getByRole("heading", { name: "Songs" })).toBeVisible();
  });
});
