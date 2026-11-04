# Spotify Web Reconstruction - Permissions, Boundaries & DRM Limitations

This document explicitly defines the boundaries between observable public capabilities, authenticated user capabilities, DRM/proprietary systems, and our production reconstruction architecture.

---

## 1. Feature Access & Permissions Matrix

| Feature Area | Public / Anonymous Access | Authenticated User Access | Premium Entitlement |
| :--- | :--- | :--- | :--- |
| **Home Dashboard** | View trending, top artists, popular albums | Personalized recommendations, recently played | Ad-free listening banners |
| **Search & Discovery** | Search catalog, browse genre hub tiles | Search history saved, personalized search | Unrestricted |
| **Music Content Pages** | Browse albums, artists, public playlists | Save album, follow artist, save playlist | Unrestricted |
| **Audio Playback** | Full audio playback with demo/streaming audio | Full audio playback + history tracking | Very High (320kbps) quality toggle |
| **Playlists & Library** | Inaccessible / Read-only public playlists | Create, edit, reorder, delete playlists; Liked Songs | Simulated offline download toggle |
| **Queue Management** | Add to queue, shuffle, repeat, clear | Sync queue across user sessions | Unrestricted |
| **Settings & Preferences** | Default browser preferences | Persist crossfade, autoplay, language to database | Unrestricted |

---

## 2. Audio Playback, DRM & Spotify API Realities

### The Technical Reality of Spotify Audio
1. **Widevine CDM Protection**: Official Spotify Web streams are encrypted using Google Widevine DRM in 256kbps Ogg Vorbis / AAC format. These streams cannot be played back via standard HTML5 `<audio>` tags or fetched directly without proprietary Widevine Content Decryption Modules (CDM) and Spotify license keys.
2. **Spotify Web API Limitations**: The public Spotify Web API (`https://api.spotify.com/v1`) does **not** provide full audio MP3 files. In 2024, Spotify removed preview URLs (`preview_url: null`) from the public Web API for many regions and accounts.
3. **Spotify Web Playback SDK**: Spotify provides a JavaScript SDK (`https://sdk.scdn.co/spotify-player.js`) that allows playback in the browser, but it has strict prerequisites:
   - Requires an active **Spotify Premium** account.
   - Requires an OAuth 2.0 Access Token with `streaming`, `user-read-email`, `user-read-private` scopes.
   - Operates as a remote Spotify Connect target rather than an independent player.

### Reconstructed Production Architecture
To deliver a production-grade, immediately playable music experience without demanding user credentials or encountering DRM blockades:

1. **Modular Audio Provider Architecture (`AudioEngine`)**:
   - Primary: High-fidelity HTML5 Audio / Web Audio API engine loaded with high-quality, full-length audio tracks from open CDN / Royalty-free music repositories (Jamendo / Free Music Archive / Archive.org).
   - Secondary / Future-Proof Adapter: A pluggable `SpotifyWebPlaybackAdapter` interface that can connect directly to Spotify's official Web Playback SDK if the user provides their own Spotify OAuth token.
2. **Catalog Metadata Fidelity**:
   - The application seed data replicates actual Spotify tracks, artists, albums, durations, release dates, and album cover art observed from `open.spotify.com` (e.g. Billie Eilish *HIT ME HARD AND SOFT*, Sabrina Carpenter, Morgan Wallen, Kendrick Lamar).
   - Lyrics are synchronized using LRC timestamps with karaoke-style line highlighting.
3. **Realistic Audio Effects Engine**:
   - Built on the HTML5 Web Audio API:
     - **Crossfade**: Uses two parallel `AudioNodes` with `linearRampToValueAtTime` to crossfade consecutive tracks smoothly between 1 and 12 seconds.
     - **Volume Normalization**: Employs a `DynamicsCompressorNode` to normalize gain across quiet and loud recordings.
     - **Volume Slider**: Real-time gain control with smooth decibel curves.

---

## 3. Security, Privacy & Integrity Rules

1. **No Scraping Private Data**: The application only inspects and reconstructs publicly available, unauthenticated views of Spotify Web.
2. **Credential Safety**: User passwords are encrypted using `bcrypt` (10 rounds). Passwords are never returned in API responses.
3. **Data Isolation**: User playlists, liked songs, and preferences are strictly isolated by `userId` in foreign key relations with row-level ownership checks on all mutation endpoints.
4. **Independent Identity**: The application is an independent reconstruction and research engineering project with distinct licensing and branding, respecting Spotify trademarks.
