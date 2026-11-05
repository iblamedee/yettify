# Audio Quality Tier Badges (Ultra HD, HD, SD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display minimal, subtle grey quality badges ("ULTRA HD", "HD", "SD") on the active music player across Desktop Player Bar, Mobile Mini-Player, and Mobile Full-Screen Player, dynamically reflecting the playing bitrate (320 kbps for Ultra HD, 160-256 kbps for HD, 96-128 kbps/YouTube for SD) and connected to user Audio Quality streaming preferences.

**Architecture:** Create a lightweight, pure audio quality utility (`lib/audioQuality.ts`) to map bitrates, stream URLs, and user streaming preferences to standardized quality tiers (`ULTRA HD`, `HD`, `SD`). Integrate audio quality resolution into `contexts/PlayerContext.tsx` and `app/api/stream/route.ts` so playback respects preferences and detects stream bitrates. Render a minimalist, non-glowing subtle grey text-pill badge component (`components/player/AudioQualityBadge.tsx`) in all player views.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Playwright.

**Spec:** User interview requirements: 320 kbps = Ultra HD, 160-256 kbps = HD, 96-128 kbps (and YouTube) = SD; subtle grey styling for every quality (minimal, non-glowing); static label only; display on Desktop Player Bar, Mobile Mini-Player, and Mobile Full-Screen Player; streaming resolution connected with user preferences.

## Global Constraints

- Subtle grey styling for all quality tiers: minimal, clean border/background, no glow or neon accents.
- Purely static label: no interactive popups or tooltips to maintain zero clutter and high performance.
- Seamless fallback: if bitrate cannot be detected from the stream URL directly, gracefully fall back to the active user streaming preference (HIGH/VERY_HIGH -> ULTRA HD, NORMAL -> HD, LOW -> SD).
- Zero audio playback regressions: stream switching and existing audio URL handling must remain reliable and responsive.

## Review Focus

1. JioSaavn CDN audio URLs with `_320.` must reliably display `ULTRA HD`.
2. JioSaavn CDN audio URLs with `_160.` must reliably display `HD`.
3. JioSaavn CDN audio URLs with `_96.` and YouTube audio streams must reliably display `SD`.
4. Mobile Mini-Player and Mobile Full-Screen Player must fit the badge neatly without breaking text truncation or control layout.
5. Desktop Player Bar must show the badge adjacent to the track title/artist info without overflow or misalignment.

---

### Task 1: Audio Quality Utility & Unit Tests

**Files:**
- Create: `lib/audioQuality.ts`
- Create: `tests/unit/audioQuality.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type QualityTier = "ULTRA HD" | "HD" | "SD";

  export interface QualityInfo {
    tier: QualityTier;
    bitrate: number;
    label: string;
  }

  export function getQualityTierFromBitrate(bitrate: number | string | null | undefined): QualityTier;
  export function resolveStreamQuality(
    audioUrl?: string | null,
    source?: string | null,
    preferredQuality?: string | null
  ): QualityInfo;
  ```

- [ ] **Step 1: Write the failing unit tests in `tests/unit/audioQuality.test.ts`**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { getQualityTierFromBitrate, resolveStreamQuality } from "../../lib/audioQuality";

test("getQualityTierFromBitrate maps 320kbps to ULTRA HD", () => {
  assert.equal(getQualityTierFromBitrate(320), "ULTRA HD");
  assert.equal(getQualityTierFromBitrate("320"), "ULTRA HD");
});

test("getQualityTierFromBitrate maps 160-256kbps to HD", () => {
  assert.equal(getQualityTierFromBitrate(160), "HD");
  assert.equal(getQualityTierFromBitrate(256), "HD");
});

test("getQualityTierFromBitrate maps <= 128kbps to SD", () => {
  assert.equal(getQualityTierFromBitrate(96), "SD");
  assert.equal(getQualityTierFromBitrate(128), "SD");
});

test("resolveStreamQuality parses direct JioSaavn CDN URLs", () => {
  const ultra = resolveStreamQuality("https://aac.saavncdn.com/123/sample_320.mp4", "jiosaavn");
  assert.equal(ultra.tier, "ULTRA HD");
  assert.equal(ultra.bitrate, 320);

  const hd = resolveStreamQuality("https://aac.saavncdn.com/123/sample_160.mp4", "jiosaavn");
  assert.equal(hd.tier, "HD");
  assert.equal(hd.bitrate, 160);

  const sd = resolveStreamQuality("https://aac.saavncdn.com/123/sample_96.mp4", "jiosaavn");
  assert.equal(sd.tier, "SD");
  assert.equal(sd.bitrate, 96);
});

test("resolveStreamQuality handles YouTube source as SD", () => {
  const yt = resolveStreamQuality(null, "youtube");
  assert.equal(yt.tier, "SD");
  assert.equal(yt.bitrate, 128);
});

test("resolveStreamQuality falls back to user preferences when URL is generic", () => {
  assert.equal(resolveStreamQuality("/api/stream?title=test", undefined, "HIGH").tier, "ULTRA HD");
  assert.equal(resolveStreamQuality("/api/stream?title=test", undefined, "NORMAL").tier, "HD");
  assert.equal(resolveStreamQuality("/api/stream?title=test", undefined, "LOW").tier, "SD");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader tsx tests/unit/audioQuality.test.ts` or `npx tsx tests/unit/audioQuality.test.ts`
Expected: FAIL with module `audioQuality` not found.

- [ ] **Step 3: Implement `lib/audioQuality.ts`**

Implement `getQualityTierFromBitrate` and `resolveStreamQuality` adhering strictly to the required bitrate thresholds and URL inspection logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/audioQuality.test.ts`
Expected: All 6 unit tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/audioQuality.ts tests/unit/audioQuality.test.ts
git commit -m "feat: implement audio quality tier resolution utility and unit tests"
```

---

### Task 2: Subtle Grey AudioQualityBadge Component

**Files:**
- Create: `components/player/AudioQualityBadge.tsx`

**Interfaces:**
- Consumes: `QualityTier` from `lib/audioQuality.ts`
- Produces:
  ```typescript
  export interface AudioQualityBadgeProps {
    tier?: QualityTier | null;
    className?: string;
    testId?: string;
  }
  export function AudioQualityBadge(props: AudioQualityBadgeProps): React.JSX.Element | null;
  ```

- [ ] **Step 1: Implement `AudioQualityBadge` component**

Style with minimal, non-glowing subtle grey text pill:
- Classes: `inline-flex items-center justify-center text-[9px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/60 bg-zinc-800/50 text-zinc-300 uppercase select-none leading-none`
- Renders `ULTRA HD`, `HD`, or `SD`.
- If `tier` is null or undefined, returns null.

- [ ] **Step 2: Verify component TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/player/AudioQualityBadge.tsx
git commit -m "feat: create minimalist subtle grey AudioQualityBadge component"
```

---

### Task 3: Stream API Route & PlayerContext Audio Quality State

**Files:**
- Modify: `app/api/stream/route.ts`
- Modify: `contexts/PlayerContext.tsx`

**Interfaces:**
- Consumes: `resolveStreamQuality`, `QualityTier` from `lib/audioQuality.ts`
- Produces:
  - `playbackQuality: QualityTier` exposed in `PlayerContextType`
  - `/api/stream` accepts optional `bitrate` parameter and returns `bitrate` & `qualityTier` in JSON response.

- [ ] **Step 1: Update `app/api/stream/route.ts`**

- Extract `bitrate` from `searchParams` (`"96" | "160" | "320"`, default `"320"`).
- Pass `bitrate` to `resolveAudioForTrack(resolvedTitle, resolvedArtist, targetBitrate, durationNum)`.
- When returning JSON response, calculate `qualityTier` using `resolveStreamQuality` and include `{ success: true, audioUrl, source, bitrate, qualityTier }`.

- [ ] **Step 2: Update `contexts/PlayerContext.tsx`**

- Add `playbackQuality: QualityTier` to `PlayerContextType` and state in `PlayerProvider` (defaulting to `"ULTRA HD"`).
- Read user's audio quality preference from `localStorage.getItem("spotify_audio_quality")` or fallback to `"HIGH"`.
- Map preference (`LOW` -> 96, `NORMAL` -> 160, `HIGH`/`VERY_HIGH` -> 320) and pass `&bitrate=${prefBitrate}` when calling `/api/stream`.
- When audio URL is set or stream JSON is received, update `playbackQuality` with `resolveStreamQuality(audioUrl, source, userAudioQuality)`.

- [ ] **Step 3: Run TypeScript compiler check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/stream/route.ts contexts/PlayerContext.tsx
git commit -m "feat: connect audio quality tier to PlayerContext and stream resolution"
```

---

### Task 4: Player UI Integration (Desktop Bar, Mobile Mini-Player, Full-Screen Player)

**Files:**
- Modify: `components/player/PlayerBar.tsx`
- Modify: `components/player/FullScreenPlayerModal.tsx`

**Interfaces:**
- Consumes: `usePlayer().playbackQuality` and `AudioQualityBadge`

- [ ] **Step 1: Add `AudioQualityBadge` to Desktop Player Bar in `components/player/PlayerBar.tsx`**

- In the track metadata section (next to song title & artist), place `<AudioQualityBadge tier={playbackQuality} testId="desktop-quality-badge" />`.
- Ensure flex alignment is clean, vertically centered, and handles truncation cleanly.

- [ ] **Step 2: Add `AudioQualityBadge` to Mobile Mini-Player in `components/player/PlayerBar.tsx`**

- In the mobile mini-player info column, display `<AudioQualityBadge tier={playbackQuality} testId="mobile-mini-quality-badge" />` beside the artist name.

- [ ] **Step 3: Add `AudioQualityBadge` to Mobile Full-Screen Player in `components/player/FullScreenPlayerModal.tsx`**

- Under or next to the track title & artist, display `<AudioQualityBadge tier={playbackQuality} testId="fullscreen-quality-badge" />`.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/player/PlayerBar.tsx components/player/FullScreenPlayerModal.tsx
git commit -m "feat: display audio quality tier badge in Desktop, Mobile Mini, and Full-Screen players"
```

---

### Task 5: End-to-End Verification

**Files:**
- Create: `tests/e2e/quality-badge.spec.ts`

- [ ] **Step 1: Write E2E test in `tests/e2e/quality-badge.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Audio Quality Tier Badges", () => {
  test("Desktop player bar displays quality badge for playing track", async ({ page }) => {
    await page.goto("/album/alb_hmhas", { waitUntil: "networkidle" });
    const playBtn = page.getByLabel(/Play BIRDS OF A FEATHER/i);
    await expect(playBtn).toBeVisible({ timeout: 10000 });
    await playBtn.click();

    const badge = page.getByTestId("desktop-quality-badge");
    await expect(badge).toBeVisible({ timeout: 10000 });
    const text = await badge.innerText();
    expect(["ULTRA HD", "HD", "SD"]).toContain(text);
  });
});
```

- [ ] **Step 2: Run test to verify**

Run: `npx playwright test tests/e2e/quality-badge.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/quality-badge.spec.ts
git commit -m "test: add e2e tests for audio quality tier badges"
```
