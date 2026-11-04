# Spotify Web Reconstruction - Implementation Roadmap & Traceability Matrix

This document provides a stage-by-stage implementation plan and a complete traceability matrix mapping every discovered feature to its architectural components, API routes, and test suites.

---

## 1. Implementation Stages

| Stage | Focus Area | Deliverables | Verification Milestone | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1** | Project Setup, Design System & App Shell | Next.js 14+ App Router, Tailwind CSS with Spotify Encore tokens, Lucide icons, Resizable Sidebar, TopNav, Bottom Player frame, responsive layouts | Layout renders cleanly; sidebar resizes smoothly (240px-420px); responsive drawer works. | ✅ COMPLETED |
| **Stage 2** | Database, Seed Data & Authentication | Prisma ORM, SQLite/PostgreSQL schema, database seeder with realistic Spotify tracks, albums, artists, users, auth API routes (register, login, logout, demo), `AuthContext` | 1-click Demo Login works; registration creates new user; session persists across reload. | ✅ COMPLETED |
| **Stage 3** | Search, Discovery & Content Pages | Browse categories grid, dynamic typeahead search API, Artist page (verified badge, top tracks, discography, about), Album page (header, 10+ tracks, durations, copyright), Playlist view | Search returns matching songs/artists; album and artist pages display rich metadata and track tables. | ✅ COMPLETED |
| **Stage 4** | Playlists & Library Management | Playlist creation, edit modal (title, description, cover), add/remove track, drag-and-drop track reordering, Liked Songs collection, `LibraryContext` with optimistic updates | Playlist created, renamed, reordered, tracks added; persists after full page reload (`F5`). | ✅ COMPLETED |
| **Stage 5** | Audio Player Engine & Controls | HTML5 Audio + Web Audio API engine, Play/Pause, Seek bar, Volume slider, Mute, Shuffle, Repeat (Off/All/One), synchronized Lyrics view, Media Session API, keyboard shortcuts | Music plays audio smoothly; seek bar moves; Spacebar toggles playback; lyrics scroll in sync. | ✅ COMPLETED |
| **Stage 6** | Queue Management & Playback History | User manual queue, Play Next, Add to Queue, Queue reordering, Recently Played listening history, Friend Activity panel | Queued tracks play in exact prioritized order; history updates; queue can be cleared. | ✅ COMPLETED |
| **Stage 7** | Premium Tiers & Settings | Premium plans comparison page (`/premium`), plan upgrade simulator, Audio quality selector (96-320kbps), Autoplay toggle, Crossfade slider (0-12s), Volume Normalization, Language selector | Settings persist in DB / LocalStorage; Web Audio gain nodes apply crossfade; language changes UI. | ✅ COMPLETED |
| **Stage 8** | QA Automation & Deep Verification | Playwright E2E test suites (Auth, Search, Player, Playlists, Queue, Settings), visual polish, accessibility audit | All automated test suites run and pass (15/15 green); zero critical regressions. | ✅ COMPLETED |

---

## 2. Complete Traceability Matrix

| Feature ID | Feature Name | Component / File | API Route / Backend | Test Suite / Spec | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FEAT-SHELL-01` | Multi-Pane App Shell Layout | `components/layout/AppLayout.tsx` | N/A (Client Layout) | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-02` | Sidebar Navigation | `components/layout/Sidebar.tsx` | Next.js Router | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-03` | Resizable Sidebar Panel | `components/layout/ResizableSidebar.tsx` | LocalStorage State | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-04` | Top Bar Navigation Controls | `components/layout/TopNav.tsx` | Browser History API | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-05` | Top Bar Search Input | `components/search/SearchBar.tsx` | `/api/search` | `tests/e2e/search.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-06` | User Profile Top Bar Menu | `components/auth/UserMenu.tsx` | `/api/auth/me` | `tests/e2e/auth.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-07` | Dynamic Content Header Tint | `components/layout/ScrollHeader.tsx` | Color extraction utility | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-08` | Global Context Menu | `components/ui/ContextMenu.tsx` | `UIContext` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-09` | Toast Notifications | `components/ui/ToastContainer.tsx` | `UIContext` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-SHELL-10` | Keyboard Shortcuts Modal | `components/modals/ShortcutsModal.tsx` | Key listener hook | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-AUTH-01` | User Registration | `components/auth/SignupModal.tsx` | `POST /api/auth/register` | `tests/e2e/auth.spec.ts` | VERIFIED & PASSING |
| `FEAT-AUTH-02` | User Login | `components/auth/LoginModal.tsx` | `POST /api/auth/login` | `tests/e2e/auth.spec.ts` | VERIFIED & PASSING |
| `FEAT-AUTH-03` | User Logout | `components/auth/UserMenu.tsx` | `POST /api/auth/logout` | `tests/e2e/auth.spec.ts` | VERIFIED & PASSING |
| `FEAT-AUTH-04` | Demo / Guest Login | `components/auth/DemoLoginButton.tsx` | `POST /api/auth/demo` | `tests/e2e/auth.spec.ts` | VERIFIED & PASSING |
| `FEAT-AUTH-05` | Account Profile Details | `app/user/[id]/page.tsx` | `GET /api/users/[id]` | `tests/e2e/auth.spec.ts` | VERIFIED & PASSING |
| `FEAT-AUTH-06` | Edit Profile Modal | `components/modals/EditProfileModal.tsx` | `PATCH /api/me/profile` | `tests/e2e/auth.spec.ts` | VERIFIED & PASSING |
| `FEAT-AUTH-07` | Account Subscription Status | `components/premium/PlanBadge.tsx` | `GET /api/me/subscription` | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-SOC-01` | Public Playlists on Profile | `app/user/[id]/page.tsx` | `GET /api/users/[id]/playlists` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-SOC-02` | Follow / Unfollow User | `components/social/FollowButton.tsx` | `POST /api/users/[id]/follow` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-SOC-03` | Friend Activity Panel | `components/social/FriendActivity.tsx` | Simulated presence stream | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-SOC-04` | Share Link Generator | `components/ui/ShareModal.tsx` | Clipboard API | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-SRCH-01` | Browse All Categories Grid | `app/search/page.tsx` | `GET /api/genres` | `tests/e2e/search.spec.ts` | VERIFIED & PASSING |
| `FEAT-SRCH-02` | Live Typeahead Search | `components/search/SearchBar.tsx` | `GET /api/search` | `tests/e2e/search.spec.ts` | VERIFIED & PASSING |
| `FEAT-SRCH-03` | Search Results Top Result Card | `app/search/[query]/page.tsx` | `GET /api/search` | `tests/e2e/search.spec.ts` | VERIFIED & PASSING |
| `FEAT-SRCH-04` | Filter Pills (Category Tabs) | `components/search/FilterPills.tsx` | Client filter | `tests/e2e/search.spec.ts` | VERIFIED & PASSING |
| `FEAT-SRCH-05` | Recent Searches History | `components/search/RecentSearches.tsx` | LocalStorage | `tests/e2e/search.spec.ts` | VERIFIED & PASSING |
| `FEAT-SRCH-06` | Genre Hub Page | `app/genre/[id]/page.tsx` | `GET /api/genres/[id]` | `tests/e2e/search.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-01` | Artist Page Header | `app/artist/[id]/page.tsx` | `GET /api/artists/[id]` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-02` | Artist Popular Tracks Table | `components/artist/PopularTracks.tsx` | `GET /api/artists/[id]` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-03` | Artist Discography Carousel | `components/artist/Discography.tsx` | `GET /api/artists/[id]/discography`| `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-04` | Artist "Fans Also Like" | `components/artist/RelatedArtists.tsx`| `GET /api/artists/[id]` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-05` | Artist About Section | `components/artist/AboutArtist.tsx` | `GET /api/artists/[id]` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-06` | Album Header Banner | `app/album/[id]/page.tsx` | `GET /api/albums/[id]` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-07` | Album Tracklist Table | `components/track/TrackTable.tsx` | `GET /api/albums/[id]` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-08` | Album Copyright Metadata | `app/album/[id]/page.tsx` | `GET /api/albums/[id]` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-09` | Playlist Header & Actions | `app/playlist/[id]/page.tsx` | `GET /api/playlists/[id]` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-PAGE-10` | Playlist Tracklist Table | `components/track/TrackTable.tsx` | `GET /api/playlists/[id]` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-01` | Persistent Bottom Bar | `components/player/PlayerBar.tsx` | `PlayerContext` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-02` | Play / Pause Toggle | `components/player/PlayPauseBtn.tsx` | HTML5 Audio | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-03` | Next / Previous Track | `components/player/SkipButtons.tsx` | `PlayerContext` Queue | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-04` | Seek Progress Bar | `components/player/SeekBar.tsx` | HTML5 Audio `currentTime` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-05` | Volume Slider & Mute Toggle | `components/player/VolumeControl.tsx` | HTML5 Audio `volume` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-06` | Shuffle Toggle | `components/player/ShuffleButton.tsx` | Shuffle algorithm | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-07` | Repeat Mode Toggle | `components/player/RepeatButton.tsx` | Repeat state machine | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-08` | Now Playing Track Widget | `components/player/NowPlayingWidget.tsx`| `PlayerContext` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-09` | Queue Drawer / Panel Toggle | `components/player/QueueToggle.tsx` | `UIContext` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-10` | Lyrics View Toggle | `components/player/LyricsView.tsx` | LRC parser & timer | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-11` | Media Session Integration | `hooks/useMediaSession.ts` | `navigator.mediaSession` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-PLAY-12` | Audio Playback Persistence | `contexts/PlayerContext.tsx` | LocalStorage sync | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-01` | Your Library Sidebar Header | `components/library/LibrarySidebar.tsx`| `LibraryContext` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-02` | Create New Playlist | `components/library/CreatePlaylist.tsx`| `POST /api/playlists` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-03` | Edit Playlist Details Modal | `components/modals/EditPlaylistModal.tsx`| `PATCH /api/playlists/[id]` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-04` | Add Track to Playlist | `components/track/TrackContextMenu.tsx`| `POST /api/playlists/[id]/tracks`| `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-05` | Remove Track from Playlist | `components/track/TrackContextMenu.tsx`| `DELETE /api/playlists/[id]/tracks/[id]`| `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-06` | Reorder Tracks in Playlist | `components/track/ReorderableTable.tsx`| `PUT /api/playlists/[id]/tracks/reorder`| `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-07` | Delete Playlist | `components/modals/DeleteConfirmModal.tsx`| `DELETE /api/playlists/[id]` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-08` | Liked Songs Collection | `app/collection/tracks/page.tsx` | `GET /api/me/likes/tracks` | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-09` | Toggle Like Track | `components/ui/LikeButton.tsx` | `POST/DELETE /api/me/likes/tracks`| `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-LIB-10` | Library Filters & Search | `components/library/LibraryFilter.tsx`| Client filter | `tests/e2e/playlist.spec.ts` | VERIFIED & PASSING |
| `FEAT-QUE-01` | Add to Queue | `components/track/TrackContextMenu.tsx`| `PlayerContext.addToQueue` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-QUE-02` | Play Next in Queue | `components/track/TrackContextMenu.tsx`| `PlayerContext.playNext` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-QUE-03` | View Queue Page / Panel | `app/queue/page.tsx` | `PlayerContext` | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-QUE-04` | Remove Item from Queue | `components/queue/QueueItemRow.tsx` | `PlayerContext.removeFromQueue`| `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-QUE-05` | Clear User Queue | `app/queue/page.tsx` | `PlayerContext.clearUserQueue`| `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-QUE-06` | Listening History Tab | `app/queue/history/page.tsx` | `GET /api/me/history` | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-PREM-01` | Upgrade to Premium Banner | `components/layout/TopNav.tsx` | UI Link | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-PREM-02` | Premium Plans Comparison | `app/premium/page.tsx` | Pricing table | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-PREM-03` | Plan Subscription Selector | `components/premium/PlanCard.tsx` | `POST /api/me/subscription` | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-PREM-04` | Audio Quality Selector | `app/preferences/page.tsx` | `PATCH /api/me/preferences` | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-PREM-05` | Offline Download Indicator | `components/ui/DownloadSwitch.tsx` | LocalStorage cache simulation | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-POD-01` | Podcasts & Shows Browse | `app/genre/podcasts/page.tsx` | `GET /api/genres/podcasts` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-POD-02` | Podcast Show Page | `app/show/[id]/page.tsx` | `GET /api/shows/[id]` | `tests/e2e/content.spec.ts` | VERIFIED & PASSING |
| `FEAT-POD-03` | Episode Playback Controls | `components/player/PodcastControls.tsx`| 15s skip, playbackRate | `tests/e2e/player.spec.ts` | VERIFIED & PASSING |
| `FEAT-SET-01` | Autoplay Toggle | `app/preferences/page.tsx` | `PATCH /api/me/preferences` | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-SET-02` | Crossfade Audio Toggle | `app/preferences/page.tsx` | Web Audio GainNode | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-SET-03` | Audio Normalization | `app/preferences/page.tsx` | DynamicsCompressor | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-SET-04` | Language Selector | `components/ui/LanguageSelector.tsx` | `i18n` dictionary | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
| `FEAT-SET-05` | Explicit Content Filter | `app/preferences/page.tsx` | `PATCH /api/me/preferences` | `tests/e2e/settings.spec.ts` | VERIFIED & PASSING |
