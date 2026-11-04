# Spotify Web Reconstruction - Route Inventory

This document maps all application routes, URL patterns, parameters, queries, access restrictions, primary components, and fallback behaviors.

---

## Route Map

| URL Path | Route Pattern | Page Title | Access Level | Primary Layout / Component | Query Parameters | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Root | `Spotify – Web Player: Music for everyone` | Public / Guest / User | `HomePage` inside `AppLayout` | None | Main dashboard featuring "Recently played", "Made for you", "Popular artists", "Popular albums", "Trending songs" |
| `/search` | Search & Browse | `Search for Songs, Artists, Podcasts` | Public | `SearchBrowsePage` | `q` (optional), `type` (optional) | When `q` is absent: Browse All Category Cards grid (Pop, Hip-Hop, Rock, etc.). When `q` present: Dynamic results view. |
| `/search/[query]` | Search Results | `Search results for "{query}"` | Public | `SearchResultsPage` | `type` (`all`, `tracks`, `artists`, `albums`, `playlists`) | Top Result card, Songs list, Artists carousel, Albums carousel, Playlists grid with filter pills. |
| `/album/[id]` | Album Detail | `{Album Title} - Album by {Artist}` | Public | `AlbumDetailPage` | `highlight` (track ID) | Album header (artwork, type, title, artist link, year, track count, total time), full tracklist table with duration & stream counts, copyright footer, more by artist. |
| `/artist/[id]` | Artist Profile | `{Artist Name} | Spotify` | Public | `ArtistDetailPage` | None | Verified artist badge, monthly listeners, follow button, popular tracks (top 5/10), discography carousel with filters (all, albums, singles), artist playlists, fans also like, about section with rank and bio. |
| `/artist/[id]/discography/[type]` | Discography Full | `{Artist Name} - Discography` | Public | `DiscographyPage` | `type` (`all`, `album`, `single`) | Full discography grid or list view for artist. |
| `/playlist/[id]` | Playlist Detail | `{Playlist Name} - playlist by {Creator}` | Public (if public) / Owner | `PlaylistDetailPage` | None | Playlist cover art, title, description, owner link, follower count, tracklist with added date, track reordering (owner only), edit modal trigger, add to library. |
| `/collection/tracks` | Liked Songs | `Liked Songs | Spotify` | Authenticated | `LikedSongsPage` | None | Dedicated collection of all user's liked tracks with purple heart gradient header, play all button, filter search, duration summary. |
| `/collection/playlists` | Your Playlists | `Your Library - Playlists` | Authenticated / Guest | `LibraryPlaylistsPage` | None | Grid of created and followed playlists with create new playlist action. |
| `/collection/artists` | Followed Artists | `Your Library - Artists` | Authenticated | `LibraryArtistsPage` | None | Grid of followed artists with round avatars. |
| `/collection/albums` | Saved Albums | `Your Library - Albums` | Authenticated | `LibraryAlbumsPage` | None | Grid of saved albums with release year and artist. |
| `/collection/podcasts` | Saved Shows | `Your Library - Podcasts` | Authenticated | `LibraryPodcastsPage` | None | Followed podcasts and saved episodes. |
| `/genre/[id]` | Category Hub | `{Genre Name} | Spotify` | Public | `GenreHubPage` | None | Curated playlists and new releases for a specific genre or mood category. |
| `/show/[id]` | Podcast Show | `{Show Name} | Spotify` | Public | `ShowDetailPage` | None | Podcast show banner, description, episode list with progress bars and duration. |
| `/episode/[id]` | Episode Detail | `{Episode Title} | Spotify` | Public | `EpisodeDetailPage` | None | Single podcast episode overview with play button and show attribution. |
| `/queue` | Playback Queue | `Queue | Spotify` | Public | `QueuePage` | None | View current playing track, user custom queued tracks with reorder and remove actions, and upcoming tracks from active album/playlist. |
| `/lyrics` | Fullscreen Lyrics | `Lyrics | Spotify` | Public | `LyricsPage` | None | Large-format synchronized lyrics display with auto-scroll highlighting active lines. |
| `/preferences` | Settings | `Settings - Spotify` | Authenticated / Guest | `PreferencesPage` | None | Playback settings (Autoplay, Crossfade, Normalization), Audio Quality selector, Explicit content filter, Language selector, Display settings. |
| `/premium` | Premium Plans | `Spotify Premium - Get 3 Months Free` | Public | `PremiumPlansPage` | None | Pricing tiers breakdown (Individual, Duo, Family, Student), features comparison matrix, upgrade simulator. |
| `/user/[id]` | User Profile | `{User Display Name} | Spotify` | Public | `UserProfilePage` | None | User avatar, display name, public playlists, follower / following counters, edit profile modal. |
| `/login` | Account Login | `Login - Spotify` | Anonymous | `LoginPage` | `callbackUrl` | Login form with email/password, demo login buttons, link to sign up. |
| `/signup` | Account Registration | `Sign up - Spotify` | Anonymous | `SignupPage` | None | Registration multi-step form with email, password, profile name, terms agreement. |

---

## Navigation & Modal Overlays (Stateful Sub-Surfaces)

These sub-surfaces sit atop routes without a full page reload:

1. **Keyboard Shortcuts Dialog (`Ctrl + /`)**: Global modal overlay listing keybindings.
2. **Edit Playlist Details Dialog**: Modal overlay on `/playlist/[id]` to change title, description, and artwork.
3. **Edit User Profile Dialog**: Modal overlay on `/user/[id]` to change display name and avatar.
4. **Context Menu Overlay**: Absolute positioned popup on right-click or `...` menu button.
5. **Add to Playlist Sub-menu**: Nested popup inside context menu showing list of user playlists.
6. **Device Picker Dropdown**: Bottom-right player popup displaying available output targets and Web Playback SDK status.
7. **Volume Popover (Mobile)**: Floating slider for mobile viewports where bottom bar space is constrained.
8. **Toast Pill (Snackbar)**: Fixed floating notification pill at bottom center (`z-index: 9999`).

---

## Route Fallbacks & 404 Handling

- **Invalid ID (`/album/invalid-id`, `/playlist/invalid-id`, `/artist/invalid-id`)**: Renders custom Spotify-styled 404 page ("Couldn't find that page. Want to try another search?") with button redirecting to `/`.
- **Unauthorized Private Playlist**: If user is not the owner of a private playlist, renders 403 Access Denied banner with prompt to request link or return home.
- **Unauthenticated Protected Routes (`/collection/tracks`, `/preferences`)**: Shows Spotify unauthenticated preview banner prompting user to log in or use the quick demo account.
