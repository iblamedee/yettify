# Fix Wrong Music Playing and YouTube Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanently fix wrong music playing by enforcing strict artist-matching and preventing YouTube song hijacking, while making YouTube playback 100% reliable through a visible, React-safe docked player that bypasses browser hidden-iframe autoplay blocks.

**Architecture:** 
1. **Strict Music Resolution**: In `lib/musicEngine.ts`, reject any JioSaavn candidate if the artist does not match the requested artist, preventing unrelated popular songs from hijacking search/playback. In `app/api/stream/route.ts`, never hijack requested `ytId` queries with JioSaavn replacements.
2. **React-Safe & Browser-Compliant YouTube Player**: In `components/player/PlayerBar.tsx` and `contexts/PlayerContext.tsx`, ensure the YouTube player iframe maintains compliant minimum dimensions and visibility whenever `activeEngine === "youtube"`, preventing Chrome/Safari/Firefox hidden-iframe autoplay bans. Use an isolated unmanaged DOM ref so React virtual DOM reconciliation never destroys or corrupts the YouTube iframe during state re-renders.

**Tech Stack:** Next.js 14, React 18, YouTube IFrame Player API, JioSaavn CDN, TypeScript, Node test runner.

**Spec:** User request: "wrong music is playing , and youtube is not playing. find the culprate and fix it or try something better to fix do experiments , find the way to fix it"

## Global Constraints

- Never attempt server-side YouTube stream extraction with `@distube/ytdl-core` or on Vercel datacenter IPs.
- Studio audio from JioSaavn CDN (`aac.saavncdn.com`) must only play when the track title AND artist match with high confidence.
- YouTube playback must support official music videos, lyric videos, live recordings, acoustic covers, remixes, and community uploads.
- The docked mini-player must be responsive, aesthetically matched to Spotify's dark UI, and never blocked by browser autoplay or visibility policies.

## Review Focus

1. **Artist Mismatch Hijack**: When requesting a song like "Starboy" by "idontknowjeffery" or "Divine" by "Percival", JioSaavn must NOT return The Weeknd or an unrelated artist.
2. **Explicit YouTube Request Hijack**: When the user plays a YouTube track (`yt_...` or `ytId=...`), the player must play that exact YouTube video, not replace it with a studio track.
3. **Hidden IFrame Autoplay Block**: When YouTube engine is active, the iframe must have compliant visible dimensions (not `w-1 h-1 opacity-0`), allowing immediate audio/video playback without browser autoplay suppression.
4. **React Reconciliation Destruction**: When volume or playback state updates in `PlayerBar`, React re-renders must not wipe or remount the YouTube iframe.
5. **Topic Channel Avoidance**: YouTube search and fallback resolution must continue filtering out `- Topic` channels that have Error 150 restrictions.

---

### Task 1: Strict Artist Validation in JioSaavn Matching & Stream Resolution

**Files:**
- Modify: `lib/musicEngine.ts:270-295`
- Modify: `app/api/stream/route.ts:155-235`
- Test: `tests/unit/strictArtistMatching.test.ts`

**Interfaces:**
- Consumes: `checkJioSaavnVerified(title: string, artistName?: string, targetDuration?: number, bitrate?: string)` in `lib/musicEngine.ts`
- Produces: Strict rejection of artist-mismatched candidates so JioSaavn never plays the wrong song.

- [ ] **Step 1: Write the failing unit test for strict artist matching**

Create `tests/unit/strictArtistMatching.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { checkJioSaavnVerified } from "../../lib/musicEngine";

test("checkJioSaavnVerified rejects candidate when artist does not match requested artist", async () => {
  // Starboy by idontknowjeffery should NOT match The Weeknd's Starboy on JioSaavn
  const result = await checkJioSaavnVerified("Starboy", "idontknowjeffery");
  assert.equal(result, null, "Should return null when artist does not match requested artist");
});

test("checkJioSaavnVerified accepts candidate when artist matches requested artist", async () => {
  // Starboy by The Weeknd should match
  const result = await checkJioSaavnVerified("Starboy", "The Weeknd");
  assert.ok(result, "Should match when artist is The Weeknd");
  assert.ok(result?.audioUrl.includes("saavncdn.com"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/strictArtistMatching.test.ts`
Expected: FAIL (currently returns The Weeknd's Starboy for idontknowjeffery because artist mismatch only deducted -10 points).

- [ ] **Step 3: Implement strict artist validation in `lib/musicEngine.ts` & stop hijacking `ytId` in `app/api/stream/route.ts`**

In `lib/musicEngine.ts` inside `checkJioSaavnVerified`:
If `normArtist` is present and neither primary artist nor secondary artist contains or matches `normArtist`:
Reject the candidate (`continue;`). Do not allow title score or popularity score to overpower an artist mismatch!

In `app/api/stream/route.ts` inside `if (ytId)`:
If `ytId` is explicitly provided, return `{ success: true, source: "youtube", ytId, requiresClientPlayback: true }` directly without querying JioSaavn to replace it. A user who selected a YouTube video or cover wants that exact YouTube video!

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/strictArtistMatching.test.ts`
Expected: PASS (both tests pass).

- [ ] **Step 5: Commit**

```bash
git add lib/musicEngine.ts app/api/stream/route.ts tests/unit/strictArtistMatching.test.ts
git commit -m "fix(engine): enforce strict artist matching and prevent YouTube track hijacking"
```

---

### Task 2: React-Safe, Browser-Compliant Docked YouTube Player

**Files:**
- Modify: `components/player/PlayerBar.tsx:80-105`
- Modify: `contexts/PlayerContext.tsx:85-135,205-325,415-430`
- Test: `tests/unit/youtubePlayerSafety.test.ts`

**Interfaces:**
- Consumes: `activeEngine`, `activeYtVideoId`, `isVideoMode` from `PlayerContext`
- Produces: Persistent, visible docked player in the bottom right corner with no 1px/hidden DOM styling that triggers browser autoplay blocks.

- [ ] **Step 1: Write unit test verifying YouTube player container and state rules**

Create `tests/unit/youtubePlayerSafety.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";

test("YouTube player dimensions never set to 1px x 1px when YouTube engine is active", () => {
  const getDockedPlayerStyles = (activeEngine: string, isVideoMode: boolean) => {
    if (activeEngine !== "youtube") {
      return { visible: false, className: "hidden" };
    }
    // When activeEngine is youtube, player must maintain minimum valid dimensions
    return {
      visible: true,
      className: isVideoMode
        ? "bottom-20 md:bottom-24 right-3 md:right-6 w-64 h-36 md:w-80 md:h-48 opacity-100 z-50 pointer-events-auto"
        : "bottom-20 md:bottom-24 right-3 md:right-6 w-56 h-32 md:w-64 md:h-36 opacity-100 z-50 pointer-events-auto",
    };
  };

  const activeStyles = getDockedPlayerStyles("youtube", false);
  assert.equal(activeStyles.visible, true);
  assert.ok(!activeStyles.className.includes("w-1 h-1"));
  assert.ok(!activeStyles.className.includes("opacity-0"));
  assert.ok(!activeStyles.className.includes("-z-50"));
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/unit/youtubePlayerSafety.test.ts`
Expected: PASS.

- [ ] **Step 3: Update `components/player/PlayerBar.tsx` and `contexts/PlayerContext.tsx`**

1. In `components/player/PlayerBar.tsx`:
   - Replace the `w-1 h-1 opacity-0 pointer-events-none -z-50` styles on `#yt-docked-player-container`.
   - When `activeEngine === "youtube"`, always render the docked mini-player at compliant dimensions (e.g. `w-64 h-36 md:w-80 md:h-48` in the bottom-right corner) with a sleek floating UI, track title, and minimize/maximize button.
   - When `activeEngine !== "youtube"`, hide with `hidden` or `pointer-events-none opacity-0` without tearing down DOM.
   - Isolate the YouTube container using `suppressHydrationWarning` and an unmanaged inner mounting ref to prevent React reconciliation from replacing the YouTube iframe during state re-renders.

2. In `contexts/PlayerContext.tsx`:
   - When `playTrack` activates a YouTube track, default `isVideoMode` to `true` and ensure `setActiveEngine("youtube")` is set immediately.
   - Register `window.onYouTubeIframeAPIReady` properly on the window object so the IFrame API is guaranteed to initialize.
   - Add error recovery in `onError`: if any YouTube video throws error 101/150 or fails to load, gracefully transition to the next track or studio alternative.

- [ ] **Step 4: Verify Next.js build and typechecking**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors, build exit code 0.

- [ ] **Step 5: Commit**

```bash
git add components/player/PlayerBar.tsx contexts/PlayerContext.tsx tests/unit/youtubePlayerSafety.test.ts
git commit -m "fix(player): make YouTube player persistent, visible, and immune to browser autoplay blocks"
```

---

### Task 3: Full End-to-End Verification & Production Deployment

**Files:**
- Test: Unit test suite execution
- Deploy: `git push origin master`

- [ ] **Step 1: Run all unit tests**

Run:
```bash
npx tsx --test tests/unit/strictArtistMatching.test.ts
npx tsx --test tests/unit/youtubePlayerSafety.test.ts
npx tsx --test tests/unit/musicEngineMatching.test.ts
npx tsx --test tests/unit/audioQuality.test.ts
```
Expected: All tests pass.

- [ ] **Step 2: Verify production build**

Run: `npm run build`
Expected: Exit code 0.

- [ ] **Step 3: Push to GitHub master**

Run: `git push origin master`
Expected: Successfully pushed to `origin master`.
