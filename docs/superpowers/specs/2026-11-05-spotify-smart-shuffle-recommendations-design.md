# Spotify Smart Shuffle & Music Recommendation Engine Design Document

## 1. Intent & Why
Spotify's **Smart Shuffle** revolutionizes passive playlist listening by transforming a static playlist into an active discovery journey. Rather than using naive pseudo-random shuffling (which clusters songs by the same artist and lacks discovery), Spotify combines two foundational systems:
1. **Balanced Dither Shuffle**: An even-spacing distribution algorithm that disperses tracks by the same artist/album across the playlist so consecutive songs feel natural and varied.
2. **Contextual Smart Discovery**: Intelligent injection of contextually matching, personalized recommendations into the playback queue, complete with visual cues ("Added by Smart Shuffle" sparkles badge) and real-time session adaptability (such as skip penalties).

This project integrates production-grade Smart Shuffle and music recommendation capabilities into Yettify, achieving full behavioral parity with Spotify while expanding capability across all playback contexts.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **3-State Shuffle State Machine**: Seamlessly cycle between `off` (sequential), `standard` (balanced dithered shuffle), and `smart` (Smart Shuffle with discovery) across all playback surfaces (Player Bar, Mobile Mini-Player, FullScreen Player, and Queue).
- **Universal Context Support**: Available across Playlists, Liked Songs, Albums, Artist Top Tracks, and Search Results.
- **Balanced Dithered Shuffle**: Replace `Math.random()` with Spotify's spread-factor algorithm that distributes tracks by the same artist/genre evenly with slight deterministic jitter.
- **Smart Queue Interleaving**: Dynamically interleave high-affinity recommended tracks into the active playback context queue at Spotify's 3:1 ratio (1 recommendation for every 3 original playlist tracks; minimum 1 recommendation for short queues < 3 tracks).
- **Acoustic & Mood Context Awareness**: Score and rank recommendation candidates using multi-dimensional acoustic feature vectors:
  - Energy (intensity & activity)
  - Valence (musical positiveness / mood)
  - Tempo (BPM continuity)
  - Danceability & Acousticness
  - Related artist proximity graph
  - Time-of-day listening context (e.g. morning uplifting, evening mellow)
- **Session Skip Learning**: If a user skips a Smart Shuffle recommendation within 15 seconds or clicks "Dismiss Recommendation" in the queue, register a negative affinity signal for that artist/genre cluster during the active session and inject a fresh replacement recommendation.
- **Seamless Audio Transitions**: Implement crossfade support (Web Audio API equal-power gain curve for HTML5 audio; smooth volume ramp for YouTube fallbacks) between tracks for unbroken playback continuity.
- **Spotify Parity UI**:
  - Shuffle button with dual/sparkle icon state and green glowing indicator dot.
  - "Added by Smart Shuffle" badge with sparkle icon on Desktop Player Bar, Mobile Mini-Player, Mobile Full-Screen Player, and Queue table.
  - Save to Liked Songs (`Heart`) / Add to Playlist actions directly from recommendation badges.
  - Queue view (`/queue`) clearly demarcating original playlist items vs. smart-injected discovery tracks.

### Non-Goals
- Modifying the user's permanent saved playlist on the server or database (Smart Shuffle recommendations are ephemeral to the playback queue, matching Spotify).
- Re-architecting the core audio streaming provider backend (direct CDN streams and YouTube fallbacks remain intact).

### Anti-Goals
- Never overwrite manually queued tracks (`userQueue`). Manual user additions always take strict priority ahead of both context tracks and smart recommendations.
- Never interrupt, pause, or restart active playback when toggling shuffle modes or dismissing recommendations.
- Never freeze or introduce network stalls when toggling Smart Shuffle; recommendation fetching and audio prefetching must be non-blocking with instant fallbacks.

---

## 3. Constraints
- **Framework & Libraries**: Next.js 14 App Router, React 18, Tailwind CSS, Lucide icons, Web Audio API, HTML5 Audio.
- **Zero Playback Disruption**: Switching shuffle modes while a song is playing must NOT restart, pause, or interrupt current playback.
- **Offline / Local Tolerance**: If recommendations network query fails or is slow, the queue gracefully falls back to standard dithered shuffle without throwing errors.

---

## 4. Approaches & Selection

### Alternative 1: Server-Managed Queue Synchronization
- Every shuffle toggle triggers a roundtrip to a Next.js API route (`/api/player/smart-shuffle`) which rebuilds the queue in database/session state.
- *Trade-off*: Adds network latency to every skip and shuffle click; risks out-of-sync playback state if network drops or latency spikes.

### Alternative 2: Hybrid Engine (Chosen & Approved)
- **Client-Side Player State & Interleaving Engine**: Real-time shuffle state, queue interleaving, dither ordering, and skip penalties managed smoothly in `PlayerContext`.
- **Intelligent Algorithmic Recommendation Engine**: Server/utility functions (`lib/recommendationEngine.ts`) calculating acoustic feature vector distances, seed cluster graphs, and candidate generation.
- **Why Chosen**: Delivers sub-millisecond responsive UI, unbroken audio streaming, offline resilience, and exact Spotify client parity.

---

## 5. Architectural Components & Detailed Specification

### 5.1 Shuffle State Machine (`contexts/PlayerContext.tsx`)
```typescript
export type ShuffleMode = "off" | "standard" | "smart";
```
- Button click cycles: `off` ➔ `standard` ➔ `smart` ➔ `off`.
- Persists to `localStorage.getItem("spotify_shuffle_mode")`.
- Backward-compatible `isShuffle: boolean` getter (`shuffleMode !== "off"`) so existing components remain fully compatible.
- **Queue Restoration**: When toggling to `standard`, unplayed recommendations are stripped from upcoming queue. When toggling to `off`, the original context order resumes from the last played original track's index. In both cases, the currently playing track finishes uninterrupted.

### 5.2 Balanced Dither Shuffle Algorithm (`lib/recommendationEngine.ts`)
Spotify's algorithm distributes songs by the same artist uniformly across the sequence:
1. Group tracks in the playlist by artist/album ID into bins.
2. Calculate target spacing intervals: `idealInterval = totalTracks / artistTrackCount`.
3. Assign each track an optimal target position with small random jitter: `pos = i * idealInterval + jitter`.
4. Sort tracks by their assigned positions to generate a cluster-free shuffle sequence.

### 5.3 Smart Shuffle Interleaving & Continuous Discovery
1. When entering `smart` mode, the current playing track and upcoming context tracks form the seed context.
2. Query candidate recommendations matching the seed tracks' genre, artist cluster, and acoustic features.
3. Filter out tracks already in the active playlist or recently played history.
4. Interleave recommendations: every 3 original tracks, insert 1 recommendation (`[T1, T2, T3, REC1, T4, T5, T6, REC2, ...]`). For small contexts (<3 tracks), at least 1 recommendation is injected.
5. When all original tracks finish, Smart Shuffle automatically transitions to continuous discovery (Autoplay), sustaining playback with fresh mood-matched recommendations.
6. Tag recommendations with:
   ```typescript
   export interface Track {
     // ...existing fields
     isSmartShuffle?: boolean;
     recommendationReason?: string; // e.g. "Based on Billie Eilish", "Matches playlist vibe"
   }
   ```

### 5.4 Acoustic Feature Scoring & Context Vector
Each track has an acoustic profile vector (or derived profile if absent):
```typescript
export interface AcousticFeatures {
  danceability: number; // 0.0 - 1.0
  energy: number;       // 0.0 - 1.0
  valence: number;      // 0.0 - 1.0 (musical happiness)
  tempo: number;        // BPM e.g. 120
  acousticness: number; // 0.0 - 1.0
}
```
Cosine similarity & Euclidean distance are computed against the seed cluster centroid to rank top candidate matches:
$$\text{Similarity}(A, B) = \frac{A \cdot B}{\|A\| \|B\|}$$

### 5.5 Session Skip Feedback & Learning
- In `PlayerContext`, tracks are timestamped on playback start.
- If a track with `isSmartShuffle === true` is skipped with `elapsedSeconds < 15` or dismissed via `X` in `/queue`, add its artist and genre to `sessionSkipPenalties`.
- Subsequent recommendation generations reduce the affinity weight for penalized artists/genres by 80% for the remainder of the session.
- Dismissing in `/queue` triggers an immediate in-place replacement with a fresh non-penalized recommendation.

### 5.6 Seamless Crossfade Engine
- Web Audio `AudioContext` and `GainNode` provide equal-power crossfading for direct HTML5 audio CDN streams.
- YouTube iframe fallbacks utilize scheduled volume fading (fade out/in) without requiring cross-origin iframe DOM tampering.
- Triggered dynamically when current playback reaches `duration - crossfadeSeconds` (configurable in preferences, 0-12s, default 3s).

### 5.7 User Interface & Visual Surfaces
- **Shuffle Button**:
  - `off`: Grey shuffle icon.
  - `standard`: Spotify green shuffle icon with green dot underneath.
  - `smart`: Spotify green shuffle icon with distinct sparkles indicator (`Sparkles` icon overlay) + green dot underneath + tooltip: "Smart Shuffle is on. Recommendations added to your queue."
- **Queue Page (`/queue`)**:
  - Injected tracks display a subtle green-tinted or glowing pill: `Sparkles` "Added by Smart Shuffle".
  - Hovering displays quick actions: "Save to Liked Songs" (`Heart`), "Add to Playlist" (`+`), and "Dismiss Recommendation" (`X`).
- **Player Bar & Full-Screen Player**:
  - Displays "Added by Smart Shuffle" adjacent to the track metadata when a recommended track is currently playing.

---

## 6. What's Left to the Builder
- Precise exponential vs. linear gain ramp formula for Web Audio crossfade.
- Exact default mock acoustic feature parameters when tracks lack pre-computed BPM in DB.
- Specific debounce duration for recommendation pre-fetching.

---

## 7. Verification Plan
- Unit tests for:
  - Spread-factor dither shuffle algorithm (verifying minimum artist distance).
  - Acoustic vector cosine similarity calculation.
  - 3:1 queue interleaving, short playlist handling, and recommendation cleanup on toggle off.
  - Skip penalty registration, re-weighting, and in-place dismissal replacement.
- E2E Playwright tests:
  - Toggle shuffle from off ➔ standard ➔ smart ➔ off and assert button attributes and state.
  - Verify Smart Shuffle inserts recommendations into `/queue` with sparkles badge.
  - Verify playback advances through interleaved recommendations smoothly.
