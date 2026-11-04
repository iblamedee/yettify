# Spotify Web Reconstruction - Acceptance Tests & QA Test Suite

This document defines the automated end-to-end (Playwright) and unit test specifications required to verify the Spotify Web reconstruction against reference behavior.

---

## Acceptance Test Suites

### Suite 1: Authentication & Account Lifecycle (`tests/e2e/auth.spec.ts`)

- **TC-AUTH-01: Demo User 1-Click Login**
  1. Navigate to `/`.
  2. Verify Top Nav shows "Sign up" and "Log in".
  3. Click "Log in" -> Click "Quick Demo Login".
  4. Verify top navigation updates with user avatar and display name.
  5. Verify session cookie is set.

- **TC-AUTH-02: Register New User & Validation**
  1. Navigate to `/signup`.
  2. Attempt submit with invalid email -> verify validation error message.
  3. Enter valid email, password, and name -> submit.
  4. Verify redirect to `/` with newly registered profile.

- **TC-AUTH-03: Edit Profile Display Name**
  1. Logged in -> Navigate to `/user/[id]`.
  2. Click "Edit Profile" -> Change display name to "Playwright Tester" -> Save.
  3. Verify toast "Profile updated" appears.
  4. Verify header and page reflect new name.

- **TC-AUTH-04: User Logout**
  1. Click User Avatar menu -> Click "Log out".
  2. Verify session cookie cleared, UI restores guest state.

---

### Suite 2: Search, Category Browsing & Navigation (`tests/e2e/search.spec.ts`)

- **TC-SRCH-01: Browse Categories Grid**
  1. Navigate to `/search`.
  2. Verify category grid renders at least 12 genre tiles (Pop, Rock, Hip-Hop, Indie, etc.).
  3. Click "Pop" category tile -> Verify URL is `/genre/pop` and displays Pop playlists.

- **TC-SRCH-02: Search Typeahead & Top Result**
  1. Focus search input (or press `Ctrl+K`).
  2. Type "Billie Eilish".
  3. Verify "Top Result" card displays "Billie Eilish" with "Artist" tag and circular avatar.
  4. Verify "Songs" section lists at least 4 matching tracks.
  5. Click filter pill "Artists" -> Verify only artist cards are visible.

---

### Suite 3: Music Content Pages (`tests/e2e/content.spec.ts`)

- **TC-PAGE-01: Album Detail Page Structure**
  1. Navigate to `/album/alb_hmhas` (Billie Eilish - *HIT ME HARD AND SOFT*).
  2. Verify album artwork, title, release year (2024), track count (10 songs).
  3. Verify track table contains 10 rows with correct track numbers, titles, and durations.
  4. Verify bottom section displays copyright notices (`© 2024 Darkroom/Interscope Records`).

- **TC-PAGE-02: Artist Profile Page Structure**
  1. Navigate to `/artist/art_billie`.
  2. Verify Verified Artist badge, monthly listeners counter, and Follow button.
  3. Verify Popular section displays top tracks with stream counters.
  4. Verify Discography section displays album cards with release years.
  5. Verify About card displays bio and world ranking (`#15 in the world`).

---

### Suite 4: Music Player & Audio Engine (`tests/e2e/player.spec.ts`)

- **TC-PLAY-01: Track Playback Activation & State Sync**
  1. Open album page.
  2. Hover track #1 -> Click Play button.
  3. Verify Bottom Player bar appears.
  4. Verify track title, artist name, and artwork match track #1.
  5. Verify play button displays Pause icon.
  6. Verify progress bar time updates (`0:01`, `0:02`, etc.).

- **TC-PLAY-02: Keyboard Shortcuts Playback Control**
  1. Press `Spacebar` -> Verify audio pauses.
  2. Press `Spacebar` -> Verify audio resumes.
  3. Press `Ctrl + Right Arrow` -> Verify advances to track #2.
  4. Press `Ctrl + Left Arrow` -> Verify returns to start or previous track.
  5. Press `M` -> Verify player mutes with muted speaker icon.

- **TC-PLAY-03: Seek & Volume Dragging**
  1. Drag seek slider to 50% -> Verify `currentTime` matches expected duration fraction.
  2. Drag volume slider to 20% -> Verify volume decreases.

- **TC-PLAY-04: Shuffle & Repeat Modes**
  1. Click Shuffle button (`Ctrl+S`) -> Verify green dot indicator active.
  2. Click Repeat button (`Ctrl+R`) -> Cycles Off -> Repeat All -> Repeat One.
  3. Verify repeat icon shows badge `1` on Repeat One.

---

### Suite 5: Playlists & Library Management (`tests/e2e/playlist.spec.ts`)

- **TC-LIB-01: Create Playlist & Persistence**
  1. Logged in -> Click "+" in Library or press `Ctrl+N`.
  2. Verify new playlist created with title "My Playlist #1".
  3. Verify page redirects to `/playlist/[id]`.
  4. Click playlist title -> Change name to "Roadtrip Vibes" -> Save.
  5. Reload page (`F5`) -> Verify title persists as "Roadtrip Vibes".

- **TC-LIB-02: Add Track to Playlist & Verify**
  1. Navigate to an album -> Right click track -> "Add to playlist" -> Select "Roadtrip Vibes".
  2. Verify toast notification appears.
  3. Navigate to "Roadtrip Vibes" -> Verify track is present in tracklist.

- **TC-LIB-03: Reorder Tracks in Playlist**
  1. Playlist with 3 tracks.
  2. Drag track #3 to position #1.
  3. Verify order changes in UI.
  4. Reload page -> Verify moved track remains at position #1.

- **TC-LIB-04: Liked Songs Synchronization**
  1. Hover any track -> Click Heart icon.
  2. Verify Heart turns green (`#1ed760`).
  3. Navigate to `/collection/tracks` ("Liked Songs").
  4. Verify track is listed.
  5. Click Heart icon again -> Verify track removed from list.

---

### Suite 6: Queue & Playback Management (`tests/e2e/queue.spec.ts`)

- **TC-QUE-01: Add to Queue & Play Next**
  1. Track A playing.
  2. Right-click Track B -> "Add to queue".
  3. Right-click Track C -> "Play next".
  4. Open Queue panel (`/queue`).
  5. Verify "Now Playing" is Track A.
  6. Verify "Next In Queue" is Track C, followed by Track B.
  7. Skip track -> Verify Track C plays immediately.

- **TC-QUE-02: Clear Queue**
  1. With items in custom queue, click "Clear queue".
  2. Verify custom queue emptied, leaving only original album context.

---

### Suite 7: Settings & Preferences (`tests/e2e/settings.spec.ts`)

- **TC-SET-01: Change Audio Settings & Persist**
  1. Navigate to `/preferences`.
  2. Toggle Crossfade to 5 seconds.
  3. Change Audio Quality to "High".
  4. Reload page -> Verify Crossfade slider remains at 5s.

- **TC-SET-02: Language Selector**
  1. Open Language picker in footer or settings.
  2. Switch to Spanish ("Español").
  3. Verify primary UI labels update ("Inicio", "Buscar", "Tu biblioteca").
  4. Switch back to English.
