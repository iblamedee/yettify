# Spotify Web Reconstruction - Component Architecture

This document describes the modular component tree, data flow, React context providers, and UI hierarchy for the Spotify Web reconstruction.

---

## 1. Top-Level Application Shell Hierarchy

```
AppLayout
├── UIProvider
├── AuthProvider
├── LibraryProvider
└── PlayerProvider
    ├── TopNav
    │   ├── HistoryNavButtons (Back / Forward)
    │   ├── SearchBar (when on /search or in header)
    │   ├── PremiumPillButton
    │   ├── InstallAppButton
    │   └── UserProfileDropdown
    │       ├── Avatar / Initial
    │       ├── AccountLink
    │       ├── ProfileLink
    │       ├── SettingsLink
    │       └── LogoutButton
    ├── ShellBody (Flex / Grid container)
    │   ├── Sidebar (Resizable 240px - 420px)
    │   │   ├── NavigationBox (Home, Search)
    │   │   ├── LibraryBox
    │   │   │   ├── LibraryHeader (Your Library, Create Playlist '+', Expand)
    │   │   │   ├── FilterPills (Playlists, Artists, Albums)
    │   │   │   ├── LibrarySearch & Sort
    │   │   │   └── LibraryItemList
    │   │   │       ├── LikedSongsRow (Pinned)
    │   │   │       └── UserPlaylists & FollowedItems
    │   │   └── ResizableDividerHandle
    │   ├── MainContentViewport (Scrollable with scroll listener)
    │   │   ├── DynamicGradientBackground
    │   │   ├── PageContent:
    │   │   │   ├── HomePage
    │   │   │   ├── SearchBrowsePage
    │   │   │   ├── SearchResultsPage
    │   │   │   ├── AlbumDetailPage
    │   │   │   ├── ArtistDetailPage
    │   │   │   ├── PlaylistDetailPage
    │   │   │   ├── LikedSongsPage
    │   │   │   ├── QueuePage
    │   │   │   ├── LyricsPage
    │   │   │   ├── PreferencesPage
    │   │   │   ├── PremiumPlansPage
    │   │   │   └── UserProfilePage
    │   │   └── GlobalFooter (Language picker, Links, Copyright)
    │   └── RightDrawer (Collapsible Now Playing / Queue / Friend Activity)
    │       ├── QueuePanel
    │       ├── NowPlayingArtPanel
    │       └── FriendActivityPanel
    ├── PlayerBar (Persistent Bottom Bar 90px)
    │   ├── NowPlayingLeft
    │   │   ├── ThumbnailArtwork
    │   │   ├── TrackMeta (Title with marquee/truncation, Artist link)
    │   │   └── LikeHeartButton
    │   ├── PlayerControlsCenter
    │   │   ├── PrimaryControlsRow
    │   │   │   ├── ShuffleButton
    │   │   │   ├── PrevButton
    │   │   │   ├── PlayPauseButton (Green circle or simple icon)
    │   │   │   ├── NextButton
    │   │   │   └── RepeatButton (Off -> All -> One)
    │   │   └── TimelineSeekRow
    │   │       ├── CurrentTimeLabel
    │   │       ├── SeekSlider (Draggable progress bar)
    │   │       └── TotalDurationLabel
    │   └── PlayerUtilityRight
    │       ├── LyricsToggle
    │       ├── QueueToggle
    │       ├── ConnectDevicePicker
    │       ├── VolumeMuteButton
    │       ├── VolumeSlider
    │       └── FullscreenLyricsButton
    ├── GlobalModals & Portals
    │   ├── KeyboardShortcutsModal
    │   ├── EditPlaylistModal
    │   ├── EditProfileModal
    │   ├── ContextMenuPortal
    │   └── ToastContainer
```

---

## 2. State Management & Context Providers

### `PlayerContext` (`contexts/PlayerContext.tsx`)
Responsible for continuous, uninterrupted audio playback across routing transitions.
- **State**:
  - `currentTrack`: Active `Track` object or `null`.
  - `isPlaying`: Boolean.
  - `currentTime`: Number (seconds).
  - `duration`: Number (seconds).
  - `volume`: Number (0.0 to 1.0).
  - `isMuted`: Boolean.
  - `isShuffle`: Boolean.
  - `repeatMode`: Enum (`'off' | 'all' | 'one'`).
  - `queue`: Array of `Track` objects (current playback sequence).
  - `userQueue`: Array of `Track` objects (manually queued songs prioritized next).
  - `history`: Array of `Track` objects (recently played tracks).
  - `playbackQuality`: Enum (`'low' | 'normal' | 'high' | 'very_high'`).
- **Methods**:
  - `playTrack(track, contextQueue?, startIndex?)`: Starts playback of track within an optional queue context.
  - `togglePlayPause()`: Toggles state.
  - `seekTo(seconds)`: Sets audio position.
  - `setVolume(volume)`: Updates volume.
  - `toggleMute()`: Toggles mute, preserving previous volume.
  - `nextTrack()`: Skips to next track.
  - `previousTrack()`: Returns to start of track if >3s elapsed; otherwise previous track.
  - `addToQueue(track)`: Appends track to `userQueue`.
  - `playNext(track)`: Inserts track at index 0 of `userQueue`.
  - `removeFromQueue(index)`: Removes item.
  - `clearUserQueue()`: Clears manual queue.
  - `toggleShuffle()`: Toggles shuffle.
  - `cycleRepeat()`: Cycles repeat state.

### `AuthContext` (`contexts/AuthContext.tsx`)
- **State**:
  - `user`: Current authenticated user or `null` (guest).
  - `isLoading`: Boolean.
  - `isAuthenticated`: Boolean.
- **Methods**:
  - `login(email, password)`: Authenticates user.
  - `register(payload)`: Creates user and logs in.
  - `logout()`: Clears session.
  - `quickDemoLogin()`: Instant demo account login.
  - `updateProfile(data)`: Updates avatar/displayName.

### `LibraryContext` (`contexts/LibraryContext.tsx`)
- **State**:
  - `likedTrackIds`: Set of string IDs for $O(1)$ heart lookup.
  - `userPlaylists`: Array of `Playlist` objects created/followed by user.
  - `followedArtistIds`: Set of string artist IDs.
  - `savedAlbumIds`: Set of string album IDs.
- **Methods**:
  - `toggleLikeTrack(track)`: Optimistically toggles like and syncs with `/api/me/likes/tracks`.
  - `createPlaylist(name?)`: Creates playlist and navigates to its page.
  - `updatePlaylist(id, data)`: Updates title, description, cover.
  - `deletePlaylist(id)`: Deletes playlist.
  - `addTrackToPlaylist(playlistId, trackId)`: Inserts track.
  - `removeTrackFromPlaylist(playlistId, trackId)`: Removes track.
  - `reorderPlaylistTracks(playlistId, fromIndex, toIndex)`: Updates sequence.
  - `toggleFollowArtist(artistId)`: Toggles follow status.
  - `toggleSaveAlbum(albumId)`: Toggles album save.

### `UIContext` (`contexts/UIContext.tsx`)
- **State**:
  - `sidebarWidth`: Number (persisted in `localStorage`, default 280px).
  - `isRightDrawerOpen`: Boolean.
  - `rightDrawerView`: `'queue' | 'now-playing' | 'friend-activity'`.
  - `activeModal`: Modal identifier or `null`.
  - `contextMenu`: `{ isOpen, x, y, items, targetData }`.
  - `toasts`: Array of `{ id, message, type, duration }`.
- **Methods**:
  - `setSidebarWidth(width)`: Updates width within [240, 420] px bounds.
  - `toggleRightDrawer(view?)`: Toggles side panel.
  - `openModal(modalId)` / `closeModal()`: Controls modal lifecycle.
  - `showContextMenu(e, items, targetData)`: Opens context menu at mouse coords.
  - `closeContextMenu()`: Dismisses menu.
  - `showToast(message, type?)`: Displays notification toast.
