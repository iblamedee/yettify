# Spotify Web Reconstruction - User Flows & Interaction Architecture

This document formalizes the complete user interaction flows across Spotify Web. Each flow specifies pre-conditions, user gestures, system state changes, UI transitions, and persistence checks.

---

## Journey 1: Authentication & Account Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Web Frontend
    participant AuthContext
    participant API as Next.js Auth API
    participant DB as Database (User/Session)

    User->>UI: Click "Sign up" in Top Nav
    UI->>User: Render registration modal / view
    User->>UI: Enter email, password, display name
    UI->>API: POST /api/auth/register (payload)
    API->>DB: Check unique email & Hash password (bcrypt)
    DB-->>API: Created User record
    API-->>UI: Set HTTP-only session cookie & User Profile
    UI->>AuthContext: Set active session
    UI-->>User: Refresh header: Show avatar, display name

    User->>UI: Click Avatar -> "Profile"
    UI->>User: Render /user/[id]
    User->>UI: Click "Edit Profile" -> Change name to "MusicLover"
    UI->>API: PATCH /api/me/profile { displayName: "MusicLover" }
    API->>DB: Update User record
    DB-->>API: Success
    API-->>UI: 200 OK with updated user
    UI-->>User: Toast "Profile saved", avatar header updates

    User->>UI: Click Avatar -> "Log out"
    UI->>API: POST /api/auth/logout
    API->>DB: Invalidate session
    API-->>UI: Clear session cookie
    UI->>AuthContext: Reset to guest
    UI-->>User: Redirect to /, show "Sign up" and "Log in"
```

---

## Journey 2: Search, Discovery & Playback Activation

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Shell as TopNav & SearchBar
    participant SearchPage as /search view
    participant API as Search / Catalog API
    participant Player as Global Player Engine

    User->>Shell: Type query "Billie" (or press Ctrl+K)
    Shell->>API: GET /api/search?q=Billie (debounced 250ms)
    API-->>SearchPage: Return Top Result, Tracks, Artists, Albums
    SearchPage-->>User: Render "Top Result" (Billie Eilish) + Tracks
    
    User->>SearchPage: Click artist "Billie Eilish"
    SearchPage->>UI: Navigate to /artist/[id]
    UI->>API: GET /api/artists/[id]
    API-->>UI: Artist profile, Popular tracks, Discography
    UI-->>User: Render Verified Artist banner, 81M listeners, Tracklist

    User->>UI: Click album "HIT ME HARD AND SOFT"
    UI->>API: GET /api/albums/[id]
    API-->>UI: Album header, 10 tracks, durations, copyright
    UI-->>User: Render album view

    User->>UI: Hover track #4 "BIRDS OF A FEATHER" -> Click Play button
    UI->>Player: playTrack({ track, queue: albumTracks, startIndex: 3 })
    Player->>Player: Set active track, load audio source, set isPlaying = true
    Player-->>User: Bottom bar appears: Artwork, title, green play icon, seek timer ticks
```

---

## Journey 3: Playlist Creation, Management & Track Reordering

```mermaid
flowchart TD
    Start([User in Library]) --> ClickCreate[Click '+' or press 'Ctrl+N']
    ClickCreate --> APICreate[POST /api/playlists: 'My Playlist #1']
    APICreate --> NavPlaylist[Redirect to /playlist/id]
    
    NavPlaylist --> OpenEdit[Click playlist title or cover]
    OpenEdit --> ShowModal[Render Edit Details Modal]
    ShowModal --> FillForm[Change Title: 'Summer Chill 2026', add description]
    FillForm --> SaveEdit[Click Save -> PATCH /api/playlists/id]
    SaveEdit --> UpdateHeader[Header updates optimistically]

    UpdateHeader --> BrowseMusic[Browse or Search for tracks]
    BrowseMusic --> RightClick[Right click track -> Add to Playlist]
    RightClick --> SelectPlaylist[Select 'Summer Chill 2026']
    SelectPlaylist --> APIAdd[POST /api/playlists/id/tracks]
    APIAdd --> ShowToast[Toast: 'Added to Summer Chill 2026']

    ShowToast --> ReorderTracks[Drag track row from pos #3 to pos #1]
    ReorderTracks --> PutOrder[PUT /api/playlists/id/tracks/reorder]
    PutOrder --> VerifyDB[(Database stores new sequence)]
    VerifyDB --> ReloadPage[User reloads page F5]
    ReloadPage --> FetchPlaylist[GET /api/playlists/id]
    FetchPlaylist --> AssertOrder[Verify track #1 is the moved track]
```

---

## Journey 4: Like Track, Library Synchronization & Unlike

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant TrackRow as Track Row / Player Bar
    participant LibraryCtx as Library Context
    participant API as Likes API
    participant LikedSongsView as /collection/tracks

    User->>TrackRow: Click empty Heart icon on track "CHIHIRO"
    TrackRow->>LibraryCtx: optimisticAddLike(trackId)
    TrackRow-->>User: Heart fills with Green (#1ed760), Toast: "Added to Liked Songs"
    LibraryCtx->>API: POST /api/me/likes/tracks { trackId }
    API-->>LibraryCtx: 201 Created

    User->>TrackRow: Click "Liked Songs" in Left Sidebar
    TrackRow->>LikedSongsView: Navigate to /collection/tracks
    LikedSongsView->>API: GET /api/me/likes/tracks
    API-->>LikedSongsView: Returns array of liked tracks
    LikedSongsView-->>User: Shows "CHIHIRO" at top with date added "Just now"

    User->>LikedSongsView: Click filled Green Heart to unlike
    LikedSongsView->>LibraryCtx: optimisticRemoveLike(trackId)
    LikedSongsView-->>User: Heart empties, Toast: "Removed from Liked Songs"
    LibraryCtx->>API: DELETE /api/me/likes/tracks { trackId }
    API-->>LibraryCtx: 200 OK
    LikedSongsView-->>User: Row fades and removes from table
```

---

## Journey 5: Queue Management, Shuffle, Repeat & Audio Skipping

```mermaid
flowchart TD
    Playing[Track #1 Playing from Album] --> AddQueue[User right-clicks Track X -> 'Add to queue']
    AddQueue --> QueueAppend[PlayerContext.userQueue.push(Track X)]
    QueueAppend --> AddNext[User right-clicks Track Y -> 'Play next']
    AddNext --> QueuePrepend[PlayerContext.userQueue.splice(0, 0, Track Y)]
    
    QueuePrepend --> OpenQueue[User clicks Queue button in Bottom Bar]
    OpenQueue --> QueueView[Queue panel displays: Now Playing: #1, Next: Track Y, Track X, Next from Album: #2, #3]

    QueueView --> ClickNext[User clicks Next Track button or Ctrl+Right]
    ClickNext --> ConsumeQueue[PlayerContext pop next track from userQueue -> Track Y plays]
    ConsumeQueue --> RecheckQueue[Queue view updates: Track X is next]

    RecheckQueue --> ToggleShuffle[User toggles Shuffle button]
    ToggleShuffle --> ShuffledContext[Album context list shuffled randomly without touching user queue]
    
    ShuffledContext --> ToggleRepeat[User clicks Repeat: Off -> Repeat All -> Repeat One]
    ToggleRepeat --> TrackEnd[Track finishes playing]
    TrackEnd --> CheckRepeatMode{Repeat Mode?}
    CheckRepeatMode -- "Repeat One" --> ReplaySame[Seek to 0 and replay Track Y]
    CheckRepeatMode -- "Repeat All / Off" --> PlayNextTrack[Play Track X from user queue]
```

---

## Journey 6: Settings Persistence & Audio Processing

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant SettingsView as /preferences
    participant AudioEngine as Web Audio API Controller
    participant LocalStore as LocalStorage / UserSettings DB

    User->>SettingsView: Navigate to /preferences
    User->>SettingsView: Set "Audio Quality" -> High (320 kbps)
    User->>SettingsView: Toggle "Crossfade" -> ON, 5 seconds
    User->>SettingsView: Toggle "Normalize volume" -> ON
    SettingsView->>LocalStore: Save preferences object
    SettingsView->>AudioEngine: Update gain node crossfade curve (5s) & DynamicsCompressor

    User->>SettingsView: Navigate to /album/xyz
    User->>SettingsView: Play track #1, let it reach last 5 seconds
    AudioEngine->>AudioEngine: Crossfade: fade out Track #1 gain, fade in Track #2 gain simultaneously
    User->>SettingsView: Reload browser page
    LocalStore-->>AudioEngine: Restore 5s crossfade, normalized gain, high quality stream selection
```

---

## Journey 7: Responsive Mobile & Tablet Layout Adaptations

```mermaid
flowchart LR
    Viewport{Viewport Width}
    
    Viewport -- ">= 1024px (Desktop)" --> DesktopLayout[Left Sidebar: 240-420px Resizable<br>Center: Scrollable Main View<br>Right: Optional Queue / Now Playing Panel<br>Bottom: Full 3-column Player Bar]
    
    Viewport -- "768px - 1023px (Tablet)" --> TabletLayout[Left Sidebar: Collapsed to 72px Icon Bar<br>Center: Full width main content<br>Right: Drawer overlay for Queue<br>Bottom: Player bar with condensed controls]
    
    Viewport -- "< 768px (Mobile)" --> MobileLayout[Sidebar hidden -> Bottom Navigation Bar (Home, Search, Your Library)<br>Center: 100vw content<br>Bottom: Compact Floating Mini-Player (64px) with Tap-to-expand Fullscreen Player]
```
