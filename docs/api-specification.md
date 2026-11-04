# Spotify Web Reconstruction - API Specification

This document details the RESTful API endpoints for the Spotify Web reconstruction, including HTTP methods, query/body payloads, success responses, error codes, and validation rules.

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
Creates a new user account and returns an authenticated session.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "displayName": "Jane Doe"
  }
  ```
- **Response 201 Created**:
  ```json
  {
    "user": {
      "id": "usr_98a72b",
      "email": "user@example.com",
      "displayName": "Jane Doe",
      "avatarUrl": null,
      "plan": "FREE"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Email already registered, weak password, or missing required fields.

### `POST /api/auth/login`
Authenticates existing credentials and sets an HTTP-only session cookie.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "user": {
      "id": "usr_98a72b",
      "email": "user@example.com",
      "displayName": "Jane Doe",
      "avatarUrl": "https://...",
      "plan": "FREE"
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials.

### `POST /api/auth/demo`
Provides instant 1-click access to a pre-seeded demo user with pre-populated playlists and likes.
- **Response 200 OK**: Demo user session object.

### `GET /api/auth/me`
Retrieves current session state. Returns `{ user: null }` if guest.

### `POST /api/auth/logout`
Destroys session cookie.

---

## 2. Search & Browse Endpoints

### `GET /api/search`
Queries across tracks, artists, albums, and playlists.
- **Query Parameters**:
  - `q` (string, required): Search query term (e.g. `Billie`).
  - `type` (optional): Filter type (`all`, `tracks`, `artists`, `albums`, `playlists`).
  - `limit` (integer, default 10).
- **Response 200 OK**:
  ```json
  {
    "topResult": {
      "type": "artist",
      "id": "art_billie",
      "name": "Billie Eilish",
      "avatarUrl": "https://...",
      "verified": true
    },
    "tracks": [
      {
        "id": "trk_birds",
        "title": "BIRDS OF A FEATHER",
        "duration": 210,
        "explicit": false,
        "artist": { "id": "art_billie", "name": "Billie Eilish" },
        "album": { "id": "alb_hmhas", "title": "HIT ME HARD AND SOFT", "coverUrl": "https://..." }
      }
    ],
    "artists": [...],
    "albums": [...],
    "playlists": [...]
  }
  ```

### `GET /api/genres`
Returns all browse category cards with tile colors.

---

## 3. Catalog Endpoints

### `GET /api/artists/[id]`
Returns artist profile, monthly listeners, top 5/10 tracks, discography, related artists, and bio.

### `GET /api/albums/[id]`
Returns album metadata, track list, duration, copyright notices, and artist details.

### `GET /api/tracks/[id]`
Returns track metadata, stream URL, duration, and LRC synchronized lyrics.

---

## 4. Playlists Endpoints

### `POST /api/playlists`
Creates a new playlist for the authenticated user.
- **Request Body**:
  ```json
  {
    "title": "My Playlist #1",
    "description": "Optional description",
    "isPublic": true
  }
  ```
- **Response 201 Created**: Playlist object with ID.

### `GET /api/playlists/[id]`
Returns playlist header, owner, and ordered track items.

### `PATCH /api/playlists/[id]`
Updates title, description, or custom cover art URL. (Owner only).

### `DELETE /api/playlists/[id]`
Deletes the playlist. (Owner only).

### `POST /api/playlists/[id]/tracks`
Adds track to playlist.
- **Request Body**: `{ "trackId": "trk_123" }`

### `DELETE /api/playlists/[id]/tracks/[trackId]`
Removes track from playlist.

### `PUT /api/playlists/[id]/tracks/reorder`
Updates track sequence order.
- **Request Body**: `{ "trackId": "trk_123", "newPosition": 0 }`

---

## 5. Library & User Interaction Endpoints

### `GET /api/me/likes/tracks`
Returns array of user's liked track objects.

### `POST /api/me/likes/tracks`
Likes a track. Body: `{ "trackId": "trk_123" }`.

### `DELETE /api/me/likes/tracks`
Unlikes a track. Query: `?trackId=trk_123`.

### `GET /api/me/history`
Returns user's recent listening history.

### `POST /api/me/history`
Logs a track playback event. Body: `{ "trackId": "trk_123" }`.

### `GET /api/me/preferences` / `PATCH /api/me/preferences`
Retrieves or updates user playback preferences (crossfade, autoplay, quality, language).
