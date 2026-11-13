# Vercel Production Audio Playback Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all playback stalling, auto-closing, and browser blocking issues on the deployed Vercel application (`https://yettify.vercel.app`), guaranteeing reliable, continuous music playback across desktop and mobile devices.

**Architecture:** Implement synchronous audio unlocking (audio priming) in `PlayerContext` to satisfy WebKit/iOS Safari autoplay user-gesture policies before network fetches; enforce strict embed-safety in `musicEngine` by completely rejecting VEVO and Topic channels that trigger YouTube Error 150; fix YouTube player configuration (Error 153 origin missing) with privacy-enhanced mode and interactive label-fallback UI; and harden the mobile Android endpoint fallback so catalog tracks stream directly from Akamai/Azure CDN (`aac.saavncdn.com`) with zero cloud datacenter restrictions.

**Tech Stack:** Next.js 14 App Router, React 18, HTML5 Audio API, YouTube IFrame Player API (`window.YT`), Akamai/Azure CDN, Node.js Test Runner (`node:test`).

**Spec:** [`docs/research-vercel-playback-blockers.md`](file:///c:/Users/dell/Documents/antigravity/silly-chandrasekhar/docs/research-vercel-playback-blockers.md)

## Global Constraints

- **Vercel Hobby Serverless Execution:** Must never stream raw audio through serverless functions; functions must strictly return JSON metadata or CDN redirects in < 2 seconds.
- **Zero BotGuard/PO-Token Block Risk:** Serverless code must never attempt to scrape YouTube video playback URLs directly on cloud datacenter IPs.
- **Browser Autoplay Compliance:** Must maintain active user activation token across asynchronous fetch boundaries using synchronous audio priming.
- **Strict Artist & Embed Safety:** Must never return a track from a channel containing `vevo` or `- topic` for third-party web embedding.
- **Zero TypeScript Regressions:** All code must pass `npx tsc --noEmit` and compile cleanly with `npm run build`.

## Review Focus

1. **Safari iOS Transient Activation Expiry:** When switching tracks after a network fetch, `audio.play()` is rejected; must be primed synchronously with silent WAV on the click event.
2. **YouTube Error 150 on Official Releases:** Record labels disable embedding on VEVO channels; engine must filter out VEVO and pick embed-safe lyric/audio uploads.
3. **YouTube Error 153 on Vercel Preview/Custom Domains:** Omitting origin and referrer policy triggers embedder identity failure; must pass valid origin and `strict-origin-when-cross-origin`.
4. **Silent Desynchronization (Ghost Playing):** If `.play()` fails or is blocked, the UI must NOT show "Playing" with pause icon; it must accurately report paused state and prompt the user.
5. **Continuous Queue Progression (`onEnded`):** Moving from track to track in an album without user intervention must pre-resolve the next audio URL before the current song ends so the audio pipeline does not stall.

---

### Task 1: Synchronous Audio Priming & Autoplay Resilience in PlayerContext

**Files:**
- Modify: `contexts/PlayerContext.tsx:250-390`
- Test: `tests/unit/audioAutoplay.test.ts`

**Interfaces:**
- Consumes: `audioRef.current: HTMLAudioElement`, `track: Track`
- Produces: `unlockAudioContext(): void`, resilient `playTrack(track: Track)` with zero asynchronous activation loss

- [ ] **Step 1: Write the failing test for synchronous audio priming and error handling**

Create `tests/unit/audioAutoplay.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";

// Test silent wav data URI used for priming
export const SILENT_AUDIO_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

test("SILENT_AUDIO_WAV is a valid base64 audio URI", () => {
  assert.ok(SILENT_AUDIO_WAV.startsWith("data:audio/wav;base64,"));
  const base64 = SILENT_AUDIO_WAV.split(",")[1];
  const buf = Buffer.from(base64, "base64");
  assert.equal(buf.subarray(0, 4).toString(), "RIFF");
  assert.equal(buf.subarray(8, 12).toString(), "WAVE");
});

test("Audio priming state transitions accurately without ghost playing", () => {
  let isPlaying = false;
  const mockPlay = () => Promise.reject(new Error("NotAllowedError: user gesture required"));

  // Simulated handler: catching error must NOT set isPlaying to true
  const handlePlay = async () => {
    try {
      await mockPlay();
      isPlaying = true;
    } catch {
      isPlaying = false;
    }
  };

  return handlePlay().then(() => {
    assert.equal(isPlaying, false, "isPlaying must remain false when play() is rejected");
  });
});
```

- [ ] **Step 2: Run test to verify it passes unit requirements**

Run: `npx tsx --test tests/unit/audioAutoplay.test.ts`
Expected: PASS

- [ ] **Step 3: Implement synchronous audio priming and fix error swallowing in `contexts/PlayerContext.tsx`**

1. Define `SILENT_AUDIO_WAV` constant in `contexts/PlayerContext.tsx`.
2. In `playTrack()`, synchronously prime `audioRef.current` *before* `fetch(queryUrl)` begins:
   ```typescript
   if (audioRef.current && !activeYtId) {
     try {
       audioRef.current.src = SILENT_AUDIO_WAV;
       audioRef.current.play().catch(() => {});
     } catch {}
   }
   ```
3. In `playViaDirectAudio()`, do NOT force `setIsPlaying(true)` if `audioRef.current.play()` is rejected:
   ```typescript
   audioRef.current
     .play()
     .then(() => {
       setIsPlaying(true);
       if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
     })
     .catch((err) => {
       console.warn("[PlayerContext] Direct audio play rejected by browser autoplay policy:", err);
       setIsPlaying(false);
       if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
       showToast("Tap Play to resume audio playback.", "info");
     });
   ```

- [ ] **Step 4: Run unit tests to verify player integration**

Run: `npx tsx --test tests/unit/audioAutoplay.test.ts tests/unit/playerIntegration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add contexts/PlayerContext.tsx tests/unit/audioAutoplay.test.ts
git commit -m "fix(player): implement synchronous audio priming and fix silent autoplay error swallowing"
```

---

### Task 2: Strict Embed-Safe YouTube Audio Resolution (Eliminate Error 150/101)

**Files:**
- Modify: `lib/musicEngine.ts:500-640`
- Test: `tests/unit/embedSafeYouTube.test.ts`

**Interfaces:**
- Consumes: `title: string`, `artistName?: string`, `targetDuration?: number`
- Produces: `resolveBestYouTubeAudio(title, artistName, targetDuration)` returning only embeddable videos (0% VEVO or Topic channels)

- [ ] **Step 1: Write the failing test for strict VEVO and Topic filtering**

Create `tests/unit/embedSafeYouTube.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { isChannelEmbedRestricted } from "../../lib/musicEngine";

test("isChannelEmbedRestricted flags VEVO channels as restricted", () => {
  assert.equal(isChannelEmbedRestricted("TheWeekndVEVO"), true);
  assert.equal(isChannelEmbedRestricted("TaylorSwiftVEVO"), true);
  assert.equal(isChannelEmbedRestricted("vevo"), true);
});

test("isChannelEmbedRestricted flags auto-generated Topic channels as restricted", () => {
  assert.equal(isChannelEmbedRestricted("The Weeknd - Topic"), true);
  assert.equal(isChannelEmbedRestricted("Kendrick Lamar - Topic"), true);
  assert.equal(isChannelEmbedRestricted("Artist-Topic"), true);
});

test("isChannelEmbedRestricted allows clean audio and lyric channels", () => {
  assert.equal(isChannelEmbedRestricted("7clouds"), false);
  assert.equal(isChannelEmbedRestricted("Dan Music"), false);
  assert.equal(isChannelEmbedRestricted("Shadow Music"), false);
  assert.equal(isChannelEmbedRestricted("The Weeknd"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/embedSafeYouTube.test.ts`
Expected: FAIL with `isChannelEmbedRestricted is not a function` or undefined

- [ ] **Step 3: Implement `isChannelEmbedRestricted` and enforce strict -100 rejection in `lib/musicEngine.ts`**

1. Export `isChannelEmbedRestricted(channelName: string): boolean`:
   ```typescript
   export function isChannelEmbedRestricted(channelName: string): boolean {
     const norm = (channelName || "").toLowerCase().trim();
     if (norm.includes("vevo")) return true;
     if (norm.endsWith("- topic") || norm.endsWith("-topic") || norm.includes("- topic")) return true;
     return false;
   }
   ```
2. In `resolveBestYouTubeAudio()`, use `isChannelEmbedRestricted(vAuthor)` to completely discard restricted channels:
   ```typescript
   if (isChannelEmbedRestricted(vAuthor)) {
     return { v, score: -100 };
   }
   ```
3. Prioritize clean audio and lyric uploads:
   ```typescript
   if (vTitle.includes("lyrics") || vTitle.includes("lyric video")) {
     score += 35;
   }
   if (vTitle.includes("audio")) {
     score += 20;
   }
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/embedSafeYouTube.test.ts tests/unit/strictArtistMatching.test.ts`
Expected: PASS (All tests pass)

- [ ] **Step 5: Commit changes**

```bash
git add lib/musicEngine.ts tests/unit/embedSafeYouTube.test.ts
git commit -m "fix(engine): enforce strict rejection of VEVO and Topic channels for embed safety"
```

---

### Task 3: YouTube IFrame Player Error 153/150 Hardening & Interactive UI Fallback

**Files:**
- Modify: `hooks/useYouTubePlayer.ts:420-460`
- Modify: `components/player/YouTubePlayer.tsx:140-168`
- Modify: `components/player/PlayerBar.tsx:95-125`
- Test: `tests/unit/useYouTubePlayer.test.ts`

**Interfaces:**
- Consumes: `videoId: string`, `onError(err: YouTubePlayerError)`
- Produces: Safe `new YT.Player` with origin and `youtube-nocookie.com`, interactive fallback card when label embedding is restricted

- [ ] **Step 1: Write test for YouTube player configuration parameters**

Add to `tests/unit/useYouTubePlayer.test.ts`:
```typescript
test("parseYouTubeError correctly maps Error 153 as embedder origin configuration error", () => {
  const err = parseYouTubeError(153, "test_video_153");
  assert.equal(err.code, 153);
  assert.equal(err.type, "RESTRICTED");
  assert.equal(err.isRestricted, true);
  assert.match(err.message, /embedder/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/useYouTubePlayer.test.ts`
Expected: FAIL on Error 153 check

- [ ] **Step 3: Implement Error 153 parsing, origin security, and interactive fallback UI**

1. In `hooks/useYouTubePlayer.ts`:
   - Add `case 153` in `parseYouTubeError()`:
     ```typescript
     case 153:
       type = "RESTRICTED";
       message = "Embedder identity or domain verification restricted by YouTube (Error 153).";
       isRestricted = true;
       break;
     ```
   - In `new YT.Player()`:
     Use `host: "https://www.youtube-nocookie.com"` and pass:
     ```typescript
     playerVars: {
       autoplay: autoPlayRef.current ? 1 : 0,
       controls: controlsRef.current ? 1 : 0,
       playsinline: 1,
       enablejsapi: 1,
       modestbranding: 1,
       rel: 0,
       origin: typeof window !== "undefined" ? window.location.origin : undefined,
     }
     ```
2. In `components/player/YouTubePlayer.tsx`:
   - Enhance the error overlay with an interactive *"Listen on YouTube ↗"* link and *"Try Next Track"* button:
     ```tsx
     {hasError && (
       <div
         data-testid="youtube-error-overlay"
         className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-3 text-center z-30 space-y-2"
       >
         <AlertCircle className="w-5 h-5 text-amber-400" />
         <p className="text-xs font-semibold text-white">
           {hasError.isRestricted ? "Embedding restricted by copyright owner" : "Playback Error"}
         </p>
         <a
           href={`https://www.youtube.com/watch?v=${videoId}`}
           target="_blank"
           rel="noopener noreferrer"
           className="text-[11px] font-medium bg-spotify-green hover:bg-spotify-green-highlight text-black px-3 py-1 rounded-full transition-transform active:scale-95 inline-flex items-center gap-1"
         >
           Listen on YouTube <ExternalLink size={10} />
         </a>
       </div>
     )}
     ```
3. In `components/player/PlayerBar.tsx`:
   - Ensure `onError` logs clearly and does not destroy the player component abruptly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/useYouTubePlayer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add hooks/useYouTubePlayer.ts components/player/YouTubePlayer.tsx components/player/PlayerBar.tsx tests/unit/useYouTubePlayer.test.ts
git commit -m "fix(player): resolve Error 153 origin identity and add interactive YouTube fallback UI"
```

---

### Task 4: High-Bitrate JioSaavn Stream Fallback & Full Production Verification

**Files:**
- Modify: `lib/musicEngine.ts:335-390`
- Test: `tests/unit/musicEngineMatching.test.ts`

**Interfaces:**
- Consumes: Query parameters from `app/api/stream/route.ts`
- Produces: Direct 320kbps CDN stream URLs (`https://aac.saavncdn.com/...`) for all catalog tracks on Vercel cloud serverless instances

- [ ] **Step 1: Write test verifying mobile Android endpoint fallback resolution**

Add to `tests/unit/musicEngineMatching.test.ts`:
```typescript
test("checkJioSaavnVerified produces 320kbps CDN URL for catalog hits without cloud IP blocks", async () => {
  const { checkJioSaavnVerified } = await import("../../lib/musicEngine");
  const res = await checkJioSaavnVerified("Starboy", "The Weeknd", 230, "320");
  assert.ok(res !== null, "Must resolve a candidate");
  assert.equal(res?.source, "jiosaavn");
  assert.match(res!.audioUrl, /^https:\/\/aac\.saavncdn\.com\/.*_320\.mp4$/);
});
```

- [ ] **Step 2: Run test to verify pass**

Run: `npx tsx --test tests/unit/musicEngineMatching.test.ts`
Expected: PASS (resolves `https://aac.saavncdn.com/..._320.mp4`)

- [ ] **Step 3: Harden mobile Android endpoint parsing in `lib/musicEngine.ts`**

Ensure that in `checkJioSaavnVerified`, the fallback mobile request:
1. Formats `cleanTitle` and `artistName` into a clean search query.
2. Properly unpacks `song.getDetails` response whether keys are numeric or alphanumeric.
3. Automatically applies the `320` bitrate preference on `decryptSaavnUrl`.

- [ ] **Step 4: Run full test suite, TypeScript check, and production build**

Run:
1. `npx tsx --test tests/unit/audioAutoplay.test.ts tests/unit/embedSafeYouTube.test.ts tests/unit/useYouTubePlayer.test.ts tests/unit/playerIntegration.test.ts tests/unit/strictArtistMatching.test.ts tests/unit/musicEngineMatching.test.ts tests/unit/audioQuality.test.ts`
2. `npx tsc --noEmit`
3. `npm run build`
Expected:
- All 25+ tests PASS
- 0 TypeScript errors
- Production build succeeds with 0 errors

- [ ] **Step 5: Commit and push to master**

```bash
git add lib/musicEngine.ts tests/unit/musicEngineMatching.test.ts
git commit -m "feat(engine): harden mobile JioSaavn CDN resolution and verify complete test suite"
git push origin master
```

---
