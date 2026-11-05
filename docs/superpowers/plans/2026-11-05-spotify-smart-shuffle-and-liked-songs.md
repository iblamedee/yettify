# Spotify Smart Shuffle & Liked Songs Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement production-ready Spotify Smart Shuffle with balanced dithered track distribution, acoustic and context-aware recommendation scoring, 3:1 queue interleaving, seamless crossfading, and instant "Add to Liked Songs" library synchronization with positive feedback learning.

**Architecture:** A client/server hybrid architecture extending `lib/recommendationEngine.ts` with spread-factor dithering and acoustic feature cosine similarity, coupled with `contexts/PlayerContext.tsx` managing a 3-way shuffle state machine (`off` ➔ `standard` ➔ `smart`), non-disruptive queue restoration, Web Audio gain crossfading, and immediate synchronization with `LibraryContext` / `app/api/me/likes/tracks`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Lucide icons, Web Audio API, Prisma ORM, Playwright, and Node.js test runner (`node:test`).

**Spec:** [`docs/superpowers/specs/2026-11-05-spotify-smart-shuffle-recommendations-design.md`](file:///c:/Users/dell/Documents/antigravity/silly-chandrasekhar/docs/superpowers/specs/2026-11-05-spotify-smart-shuffle-recommendations-design.md)

## Global Constraints

- **3-State Shuffle State Machine**: Shuffle button cycles strictly through `off` ➔ `standard` ➔ `smart` ➔ `off`.
- **Zero Playback Interruption**: Toggling shuffle modes or liking/dismissing tracks must never pause, stop, or restart active playback.
- **Strict 3:1 Interleaving**: Every 3 original playlist tracks interleave 1 smart recommendation (`[T1, T2, T3, REC1, T4, T5, T6, REC2]`); queues with <3 tracks insert at least 1 recommendation.
- **Manual Queue Supremacy**: `userQueue` (manually added tracks) always takes strict precedence ahead of both context tracks and smart recommendations.
- **Spotify Parity UI**:
  - Shuffle button renders standard green dot in `standard` mode and a green sparkles badge + dot in `smart` mode.
  - Recommended tracks display a distinct `Sparkles` "Added by Smart Shuffle" badge in Queue, Player Bar, and Full-Screen modals.
  - Liking any track or recommendation triggers an optimistic green `#1ed760` heart fill, "Added to Liked Songs" toast, backend persistence via `ensureTrackInDb`, and library count update.

## Review Focus

1. **Short Playlists (< 3 tracks)**: Must inject at least 1 recommendation without crashing or infinite loops.
2. **Queue Restoration on Toggle Off**: Switching from `smart` to `standard` removes future unplayed recommendations; switching to `off` restores original playlist order after the last played original track while the active song finishes uninterrupted.
3. **Foreign / Recommended Track Persistence**: Liking a recommended track generated outside local DB must safely persist via `POST /api/me/likes/tracks` and appear in `/collection/tracks`.
4. **Rapid Skip Penalty (< 15s)**: Skipping a recommendation within 15 seconds or dismissing via `X` in `/queue` applies an 80% penalty to that artist/genre cluster.
5. **Crossfade Fallback**: HTML5 audio streams apply Web Audio `GainNode` equal-power curves; YouTube fallback uses volume-ramp transitions without throwing cross-origin errors.

---

### Task 1: Smart Shuffle & Recommendation Algorithms

**Files:**
- Modify: `lib/recommendationEngine.ts`
- Create: `tests/unit/smartShuffleAlgorithms.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AcousticFeatures {
    danceability: number;
    energy: number;
    valence: number;
    tempo: number;
    acousticness: number;
  }

  export function balancedDitherShuffle<T extends { id: string; artist?: { id?: string; name: string } }>(
    tracks: T[]
  ): T[];

  export function calculateAcousticSimilarity(
    a: AcousticFeatures,
    b: AcousticFeatures
  ): number;

  export function interleaveSmartRecommendations<T extends { id: string; isSmartShuffle?: boolean }>(
    originalTracks: T[],
    recommendations: T[],
    ratio?: number
  ): T[];

  export function filterAndRankCandidates<T extends { id: string; artist?: { name: string }; genre?: { slug?: string } }>(
    candidates: T[],
    seedTrack: T,
    penalizedArtists: Set<string>,
    likedArtists: Set<string>
  ): T[];
  ```

- [ ] **Step 1: Write the failing unit tests in `tests/unit/smartShuffleAlgorithms.test.ts`**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import {
  balancedDitherShuffle,
  calculateAcousticSimilarity,
  interleaveSmartRecommendations,
  filterAndRankCandidates,
} from "../../lib/recommendationEngine.ts";

test("balancedDitherShuffle prevents artist clustering", () => {
  const tracks = [
    { id: "1", title: "Song 1", artist: { name: "Artist A" } },
    { id: "2", title: "Song 2", artist: { name: "Artist A" } },
    { id: "3", title: "Song 3", artist: { name: "Artist A" } },
    { id: "4", title: "Song 4", artist: { name: "Artist B" } },
    { id: "5", title: "Song 5", artist: { name: "Artist C" } },
    { id: "6", title: "Song 6", artist: { name: "Artist D" } },
  ];
  const shuffled = balancedDitherShuffle(tracks);
  assert.equal(shuffled.length, 6);
  // No two Artist A tracks should be immediately adjacent
  for (let i = 0; i < shuffled.length - 1; i++) {
    if (shuffled[i].artist?.name === "Artist A") {
      assert.notEqual(shuffled[i + 1].artist?.name, "Artist A");
    }
  }
});

test("calculateAcousticSimilarity returns 1 for identical vectors and penalizes distant vectors", () => {
  const v1 = { danceability: 0.8, energy: 0.7, valence: 0.6, tempo: 120, acousticness: 0.2 };
  const v2 = { danceability: 0.8, energy: 0.7, valence: 0.6, tempo: 120, acousticness: 0.2 };
  const v3 = { danceability: 0.1, energy: 0.1, valence: 0.1, tempo: 60, acousticness: 0.9 };

  const simIdentical = calculateAcousticSimilarity(v1, v2);
  const simDistant = calculateAcousticSimilarity(v1, v3);
  assert.ok(simIdentical > 0.99);
  assert.ok(simDistant < 0.6);
});

test("interleaveSmartRecommendations injects 1 recommendation every 3 tracks (3:1 ratio)", () => {
  const originals = [{ id: "o1" }, { id: "o2" }, { id: "o3" }, { id: "o4" }, { id: "o5" }, { id: "o6" }];
  const recs = [{ id: "r1" }, { id: "r2" }];

  const interleaved = interleaveSmartRecommendations(originals, recs, 3);
  // Expected: o1, o2, o3, r1, o4, o5, o6, r2
  assert.equal(interleaved.length, 8);
  assert.equal(interleaved[3].id, "r1");
  assert.equal(interleaved[3].isSmartShuffle, true);
  assert.equal(interleaved[7].id, "r2");
  assert.equal(interleaved[7].isSmartShuffle, true);
});

test("interleaveSmartRecommendations handles short queues (<3 tracks) with minimum 1 recommendation", () => {
  const originals = [{ id: "o1" }, { id: "o2" }];
  const recs = [{ id: "r1" }];

  const interleaved = interleaveSmartRecommendations(originals, recs, 3);
  assert.equal(interleaved.length, 3);
  assert.equal(interleaved[2].id, "r1");
  assert.equal(interleaved[2].isSmartShuffle, true);
});

test("filterAndRankCandidates penalizes skipped artists and boosts liked artists", () => {
  const seed = { id: "s1", artist: { name: "Billie Eilish" } };
  const candidates = [
    { id: "c1", artist: { name: "Penalized Artist" } },
    { id: "c2", artist: { name: "Liked Artist" } },
    { id: "c3", artist: { name: "Neutral Artist" } },
  ];
  const penalized = new Set(["Penalized Artist"]);
  const liked = new Set(["Liked Artist"]);

  const ranked = filterAndRankCandidates(candidates, seed, penalized, liked);
  assert.equal(ranked[0].artist?.name, "Liked Artist");
  assert.equal(ranked[ranked.length - 1].artist?.name, "Penalized Artist");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/unit/smartShuffleAlgorithms.test.ts`
Expected: FAIL with "functions not defined"

- [ ] **Step 3: Implement algorithm functions in `lib/recommendationEngine.ts`**

Add `AcousticFeatures`, `balancedDitherShuffle`, `calculateAcousticSimilarity`, `interleaveSmartRecommendations`, and `filterAndRankCandidates`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/unit/smartShuffleAlgorithms.test.ts`
Expected: PASS (all 5 tests green)

- [ ] **Step 5: Commit**

```bash
git add lib/recommendationEngine.ts tests/unit/smartShuffleAlgorithms.test.ts
git commit -m "feat(recommendations): implement balanced dither shuffle and acoustic similarity algorithms"
```

---

### Task 2: Seamless Audio Transition & Crossfade Engine

**Files:**
- Create: `lib/audioTransitions.ts`
- Create: `tests/unit/audioTransitions.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface CrossfadeGains {
    outgoingGain: number;
    incomingGain: number;
  }

  export function calculateCrossfadeGains(progress: number): CrossfadeGains;
  export function shouldTriggerCrossfade(currentTime: number, duration: number, crossfadeSeconds: number): boolean;
  ```

- [ ] **Step 1: Write the failing unit tests in `tests/unit/audioTransitions.test.ts`**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { calculateCrossfadeGains, shouldTriggerCrossfade } from "../../lib/audioTransitions.ts";

test("calculateCrossfadeGains provides equal-power curve", () => {
  const start = calculateCrossfadeGains(0);
  assert.equal(start.outgoingGain, 1);
  assert.equal(start.incomingGain, 0);

  const mid = calculateCrossfadeGains(0.5);
  // Equal-power sum of squares should approximate 1: (cos(pi/4))^2 + (sin(pi/4))^2 = 1
  const power = Math.pow(mid.outgoingGain, 2) + Math.pow(mid.incomingGain, 2);
  assert.ok(Math.abs(power - 1.0) < 0.05);

  const end = calculateCrossfadeGains(1);
  assert.equal(end.outgoingGain, 0);
  assert.equal(end.incomingGain, 1);
});

test("shouldTriggerCrossfade triggers only within crossfade window", () => {
  assert.equal(shouldTriggerCrossfade(195, 200, 5), true);
  assert.equal(shouldTriggerCrossfade(190, 200, 5), false);
  assert.equal(shouldTriggerCrossfade(100, 200, 0), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/unit/audioTransitions.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `lib/audioTransitions.ts`**

Implement equal-power trigonometric curve:
```typescript
export function calculateCrossfadeGains(progress: number): CrossfadeGains {
  const p = Math.max(0, Math.min(1, progress));
  const angle = (p * Math.PI) / 2;
  return {
    outgoingGain: Math.cos(angle),
    incomingGain: Math.sin(angle),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/unit/audioTransitions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/audioTransitions.ts tests/unit/audioTransitions.test.ts
git commit -m "feat(player): add equal-power audio crossfade calculation utility"
```

---

### Task 3: 3-State Shuffle State Machine & Queue Interleaving in PlayerContext

**Files:**
- Modify: `contexts/PlayerContext.tsx`
- Create: `tests/unit/playerShuffleStateMachine.test.ts`

**Interfaces:**
- Consumes:
  - `balancedDitherShuffle`, `interleaveSmartRecommendations`, `filterAndRankCandidates` from `lib/recommendationEngine.ts`
  - `calculateCrossfadeGains`, `shouldTriggerCrossfade` from `lib/audioTransitions.ts`
- Produces:
  ```typescript
  export type ShuffleMode = "off" | "standard" | "smart";

  export interface PlayerContextType {
    // ...existing
    shuffleMode: ShuffleMode;
    isShuffle: boolean; // getter: shuffleMode !== "off"
    cycleShuffleMode: () => void;
    dismissRecommendation: (trackId: string) => void;
  }
  ```

- [ ] **Step 1: Write the failing unit tests for queue state machine in `tests/unit/playerShuffleStateMachine.test.ts`**

```typescript
import test from "node:test";
import assert from "node:assert/strict";

// Helper pure function simulating PlayerContext state transitions
import { resolveNextShuffleMode, restoreOriginalQueueOrder, stripSmartRecommendations } from "../../lib/recommendationEngine.ts";

test("resolveNextShuffleMode cycles off -> standard -> smart -> off", () => {
  assert.equal(resolveNextShuffleMode("off"), "standard");
  assert.equal(resolveNextShuffleMode("standard"), "smart");
  assert.equal(resolveNextShuffleMode("smart"), "off");
});

test("stripSmartRecommendations removes injected tracks while retaining original queue", () => {
  const queue = [
    { id: "1", isSmartShuffle: false },
    { id: "rec1", isSmartShuffle: true },
    { id: "2", isSmartShuffle: false },
  ];
  const cleaned = stripSmartRecommendations(queue);
  assert.deepEqual(cleaned, [{ id: "1", isSmartShuffle: false }, { id: "2", isSmartShuffle: false }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/unit/playerShuffleStateMachine.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement helper functions in `lib/recommendationEngine.ts` and update `contexts/PlayerContext.tsx`**

1. Add `shuffleMode: ShuffleMode` state (hydrated from `localStorage.getItem("spotify_shuffle_mode") || "off"`).
2. Implement `cycleShuffleMode()` cycling `off` ➔ `standard` ➔ `smart` ➔ `off`. Keep `toggleShuffle()` as an alias that calls `cycleShuffleMode()`.
3. In `smart` mode, automatically interleave recommendations via `interleaveSmartRecommendations`.
4. In `contexts/PlayerContext.tsx`, track `lastOriginalTrackIndex` and preserve the immutable original playlist reference so toggling `off` restores natural sequence without stopping the active song.
5. Implement `dismissRecommendation(trackId: string)`: immediately penalizes that artist/genre and replaces the slot with a fresh recommendation in-place.
6. Connect `calculateCrossfadeGains` during `onTimeUpdate` when crossfade preference is enabled (>0s).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/unit/playerShuffleStateMachine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/recommendationEngine.ts contexts/PlayerContext.tsx tests/unit/playerShuffleStateMachine.test.ts
git commit -m "feat(player): integrate 3-state shuffle state machine, crossfade, and smart queue interleaving"
```

---

### Task 4: UI Surfaces & Spotify Smart Shuffle Sparkles Badge

**Files:**
- Create: `components/player/ShuffleButton.tsx`
- Modify: `components/player/PlayerBar.tsx`
- Modify: `components/player/FullScreenPlayerModal.tsx`

**Interfaces:**
- Consumes:
  - `usePlayer()`: `shuffleMode`, `cycleShuffleMode`, `currentTrack`
  - `useLibrary()`: `toggleLikeTrack`, `isTrackLiked`
- Produces:
  - Reusable `ShuffleButton` component rendering:
    - `off`: Grey `<Shuffle size={18} />`
    - `standard`: Spotify green icon with green bottom dot
    - `smart`: Spotify green icon with distinct `<Sparkles size={11} />` overlay badge + green bottom dot + tooltip "Smart Shuffle is on. Recommendations added to your queue."
  - Now Playing track info displays `<span data-testid="smart-shuffle-badge" className="text-[10px] text-spotify-green flex items-center gap-1 font-semibold"><Sparkles size={10} /> Smart Shuffle</span>` when `currentTrack?.isSmartShuffle` is true.

- [ ] **Step 1: Create `components/player/ShuffleButton.tsx`**

Implement the 3-state button with accessible labels and tooltips:
```tsx
"use client";
import React from "react";
import { Shuffle, Sparkles } from "lucide-react";
import { usePlayer, ShuffleMode } from "@/contexts/PlayerContext";

export function ShuffleButton({ size = 18, className = "" }: { size?: number; className?: string }) {
  const { shuffleMode, cycleShuffleMode } = usePlayer();

  const getTitle = () => {
    if (shuffleMode === "smart") return "Smart Shuffle is on. Recommendations added to your queue.";
    if (shuffleMode === "standard") return "Shuffle is on.";
    return "Enable shuffle";
  };

  return (
    <button
      onClick={cycleShuffleMode}
      data-testid="player-shuffle-button"
      data-shuffle-mode={shuffleMode}
      className={`relative p-1 transition-all hover:scale-105 active:scale-95 ${
        shuffleMode !== "off" ? "text-spotify-green" : "text-[#b3b3b3] hover:text-white"
      } ${className}`}
      title={getTitle()}
      aria-label={getTitle()}
    >
      <div className="relative">
        <Shuffle size={size} />
        {shuffleMode === "smart" && (
          <Sparkles
            size={10}
            className="absolute -top-1.5 -right-2 text-spotify-green fill-spotify-green animate-pulse"
          />
        )}
      </div>
      {shuffleMode !== "off" && (
        <span className="w-1 h-1 bg-spotify-green rounded-full absolute -bottom-1 left-1/2 -translate-x-1/2" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Replace inline shuffle buttons in `PlayerBar.tsx` and `FullScreenPlayerModal.tsx`**

Use `<ShuffleButton />` and add the "Added by Smart Shuffle" indicator next to the active track title/artist info in both desktop player bar and mobile modals.

- [ ] **Step 3: Run TypeScript compiler check to verify clean compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/player/ShuffleButton.tsx components/player/PlayerBar.tsx components/player/FullScreenPlayerModal.tsx
git commit -m "feat(ui): add 3-state shuffle button with sparkles icon and smart shuffle track badges"
```

---

### Task 5: Queue Discovery & Liked Songs Integration

**Files:**
- Modify: `app/queue/page.tsx`
- Modify: `components/track/TrackTable.tsx`
- Modify: `contexts/LibraryContext.tsx`

**Interfaces:**
- Consumes:
  - `usePlayer()`: `contextQueue`, `dismissRecommendation`, `currentTrack`, `shuffleMode`
  - `useLibrary()`: `toggleLikeTrack`, `isTrackLiked`
- Behavior:
  - Recommendations in `/queue` display a subtle badge: `<span className="px-2 py-0.5 rounded-full bg-spotify-green/10 text-spotify-green text-[11px] font-medium flex items-center gap-1 border border-spotify-green/20"><Sparkles size={11} /> Added by Smart Shuffle</span>`.
  - Quick action buttons on hover:
    - Save to Liked Songs (`Heart` icon): calls `toggleLikeTrack(track)` with optimistic green fill, toast "Added to Liked Songs", and boosts affinity in recommendation engine.
    - Dismiss recommendation (`X` icon): calls `dismissRecommendation(track.id)`, which registers the 15-second skip penalty and replaces the item in-place with a fresh recommendation.

- [ ] **Step 1: Update `contexts/LibraryContext.tsx` to notify recommendations engine of liked tracks**

When a track is liked, export and call a helper in `lib/recommendationEngine.ts` to add the track's artist to `likedArtists` set in the session, boosting recommendation weights for that style.

- [ ] **Step 2: Update `app/queue/page.tsx` to render Smart Shuffle badges and dismiss actions**

Display the `Sparkles` badge on interleaved tracks and render the `Heart` (Like) and `X` (Dismiss) actions.

- [ ] **Step 3: Run TypeScript compilation check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add contexts/LibraryContext.tsx app/queue/page.tsx components/track/TrackTable.tsx
git commit -m "feat(queue): add smart shuffle queue badges, in-place dismissal, and liked songs reinforcement"
```

---

### Task 6: End-to-End Playwright Verification

**Files:**
- Create: `tests/e2e/smartShuffle.spec.ts`

- [ ] **Step 1: Write the Playwright E2E test suite in `tests/e2e/smartShuffle.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Spotify Smart Shuffle & Liked Songs Verification", () => {
  test("TC-SMART-01: Shuffle button cycles off -> standard -> smart -> off", async ({ page }) => {
    await page.goto("/album/alb_hmhas", { waitUntil: "domcontentloaded" });

    // Play first track to activate PlayerBar
    const playBtn = page.getByLabel(/Play BIRDS OF A FEATHER/i);
    await playBtn.click();

    const shuffleBtn = page.locator('[data-testid="player-shuffle-button"]');
    await expect(shuffleBtn).toBeVisible({ timeout: 5000 });

    // Initial state: off
    await expect(shuffleBtn).toHaveAttribute("data-shuffle-mode", "off");

    // Click 1: standard
    await shuffleBtn.click();
    await expect(shuffleBtn).toHaveAttribute("data-shuffle-mode", "standard");

    // Click 2: smart
    await shuffleBtn.click();
    await expect(shuffleBtn).toHaveAttribute("data-shuffle-mode", "smart");
    await expect(shuffleBtn.locator("svg").nth(1)).toBeVisible(); // Sparkles icon

    // Click 3: off
    await shuffleBtn.click();
    await expect(shuffleBtn).toHaveAttribute("data-shuffle-mode", "off");
  });

  test("TC-SMART-02: Smart Shuffle interleaves recommendations in /queue with badge and like action", async ({ page }) => {
    await page.goto("/album/alb_hmhas", { waitUntil: "domcontentloaded" });
    await page.getByLabel(/Play BIRDS OF A FEATHER/i).click();

    const shuffleBtn = page.locator('[data-testid="player-shuffle-button"]');
    await shuffleBtn.click(); // off -> standard
    await shuffleBtn.click(); // standard -> smart

    // Open queue page
    await page.goto("/queue", { waitUntil: "domcontentloaded" });

    // Verify at least one smart shuffle badge is present
    const smartBadge = page.locator('[data-testid="queue-smart-shuffle-badge"]').first();
    await expect(smartBadge).toBeVisible({ timeout: 10000 });
    await expect(smartBadge).toContainText(/Added by Smart Shuffle/i);

    // Liking the recommended track adds to Liked Songs
    const recLikeBtn = page.locator('[data-testid="queue-smart-like-button"]').first();
    await recLikeBtn.click();

    // Verify toast or liked state
    await page.goto("/collection/tracks", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Liked Songs" }).first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run all unit tests to ensure zero regressions**

Run: `node --experimental-strip-types --test tests/unit/smartShuffleAlgorithms.test.ts tests/unit/audioTransitions.test.ts tests/unit/playerShuffleStateMachine.test.ts`
Expected: All PASS

- [ ] **Step 3: Run the Playwright E2E suite**

Run: `npx playwright test tests/e2e/smartShuffle.spec.ts`
Expected: PASS (all tests green)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/smartShuffle.spec.ts
git commit -m "test(smart-shuffle): add comprehensive Playwright E2E test suite"
```
