"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Playlist, Track, Album, Artist } from "@/types";
import { useAuth } from "./AuthContext";
import { useUI } from "./UIContext";
import { useRouter } from "next/navigation";

interface LibraryContextType {
  likedTrackIds: Set<string>;
  likedTracks: Track[];
  userPlaylists: Playlist[];
  followedArtistIds: Set<string>;
  followedArtists: Artist[];
  savedAlbumIds: Set<string>;
  savedAlbums: Album[];
  isLoading: boolean;
  toggleLikeTrack: (track: Track) => Promise<boolean>;
  isTrackLiked: (trackId: string) => boolean;
  createPlaylist: (title?: string) => Promise<Playlist | null>;
  updatePlaylist: (id: string, data: { title?: string; description?: string; coverUrl?: string }) => Promise<boolean>;
  deletePlaylist: (id: string) => Promise<boolean>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<boolean>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<boolean>;
  reorderPlaylistTracks: (playlistId: string, trackId: string, newPosition: number) => Promise<boolean>;
  toggleFollowArtist: (artistId: string, artistData?: any) => Promise<boolean>;
  isArtistFollowed: (artistId: string) => boolean;
  toggleSaveAlbum: (albumId: string, albumData?: any) => Promise<boolean>;
  isAlbumSaved: (albumId: string) => boolean;
  refreshLibrary: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { showToast, openModal } = useUI();
  const router = useRouter();

  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [followedArtistIds, setFollowedArtistIds] = useState<Set<string>>(new Set());
  const [followedArtists, setFollowedArtists] = useState<Artist[]>([]);
  const [savedAlbumIds, setSavedAlbumIds] = useState<Set<string>>(new Set());
  const [savedAlbums, setSavedAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      refreshLibrary();
    } else {
      setLikedTrackIds(new Set());
      setLikedTracks([]);
      setUserPlaylists([]);
      setFollowedArtistIds(new Set());
      setFollowedArtists([]);
      setSavedAlbumIds(new Set());
      setSavedAlbums([]);
    }
  }, [user]);

  const refreshLibrary = async () => {
    setIsLoading(true);
    try {
      const [likesRes, playlistsRes, artistsRes, albumsRes] = await Promise.all([
        fetch("/api/me/likes/tracks"),
        fetch("/api/playlists"),
        fetch("/api/me/following/artists"),
        fetch("/api/me/likes/albums"),
      ]);

      if (likesRes.ok) {
        const data = await likesRes.json();
        const fetchedIds: string[] = data.trackIds || [];
        const fetchedTracks: Track[] = data.tracks || [];
        setLikedTrackIds(new Set(fetchedIds));
        setLikedTracks(fetchedTracks);
      }
      if (playlistsRes.ok) {
        const data = await playlistsRes.json();
        setUserPlaylists((prev) => {
          const fetched: Playlist[] = data.playlists || [];
          const fetchedIds = new Set(fetched.map((p) => p.id));
          const localOnly = prev.filter((p) => !fetchedIds.has(p.id));
          return [...localOnly, ...fetched];
        });
      }
      if (artistsRes.ok) {
        const data = await artistsRes.json();
        setFollowedArtistIds(new Set(data.artistIds || []));
        setFollowedArtists((prev) => {
          const fetched: Artist[] = data.artists || [];
          const fetchedIds = new Set(fetched.map((a) => a.id));
          const localOnly = prev.filter((a) => !fetchedIds.has(a.id));
          return [...localOnly, ...fetched];
        });
      }
      if (albumsRes.ok) {
        const data = await albumsRes.json();
        setSavedAlbumIds(new Set(data.albumIds || []));
        setSavedAlbums((prev) => {
          const fetched: Album[] = data.albums || [];
          const fetchedIds = new Set(fetched.map((a) => a.id));
          const localOnly = prev.filter((a) => !fetchedIds.has(a.id));
          return [...localOnly, ...fetched];
        });
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const isTrackLiked = (trackId: string) => likedTrackIds.has(trackId);
  const isArtistFollowed = (artistId: string) => followedArtistIds.has(artistId);
  const isAlbumSaved = (albumId: string) => savedAlbumIds.has(albumId);

  const toggleLikeTrack = async (track: Track): Promise<boolean> => {
    if (!user) {
      openModal("auth");
      showToast("Please log in to save songs to your library", "info");
      return false;
    }

    const wasLiked = likedTrackIds.has(track.id);
    const prevLikedTrackIds = new Set(likedTrackIds);
    const prevLikedTracks = [...likedTracks];

    // Optimistic UI updates
    if (wasLiked) {
      setLikedTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
      setLikedTracks((prev) => prev.filter((t) => t.id !== track.id));
      showToast("Removed from Liked Songs", "info");
    } else {
      const optimisticTrack: Track = {
        ...track,
        likedAt: new Date().toISOString(),
      };
      setLikedTrackIds((prev) => new Set(prev).add(track.id));
      setLikedTracks((prev) => [optimisticTrack, ...prev.filter((t) => t.id !== track.id)]);
      showToast("Added to Liked Songs", "success");
    }

    try {
      if (wasLiked) {
        const res = await fetch(`/api/me/likes/tracks?trackId=${encodeURIComponent(track.id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove like");
      } else {
        const res = await fetch("/api/me/likes/tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId: track.id, track }),
        });
        if (!res.ok) throw new Error("Failed to save like");
        const data = await res.json();
        if (data.track) {
          setLikedTracks((prev) =>
            prev.map((t) => (t.id === track.id ? { ...data.track, likedAt: t.likedAt || data.track.likedAt } : t))
          );
        }
      }
      return !wasLiked;
    } catch (err) {
      // Revert on failure
      setLikedTrackIds(prevLikedTrackIds);
      setLikedTracks(prevLikedTracks);
      showToast("Failed to update liked songs", "error");
      return wasLiked;
    }
  };

  const createPlaylist = async (title?: string): Promise<Playlist | null> => {
    if (!user) {
      showToast("Please log in to create a playlist", "info");
      return null;
    }

    const count = userPlaylists.length + 1;
    const defaultTitle = title || `My Playlist #${count}`;

    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: defaultTitle }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserPlaylists((prev) => [data.playlist, ...prev]);
        showToast(`Created playlist "${data.playlist.title}"`, "success");
        router.push(`/playlist/${data.playlist.id}`);
        return data.playlist;
      }
    } catch {
      showToast("Failed to create playlist", "error");
    }
    return null;
  };

  const updatePlaylist = async (id: string, data: { title?: string; description?: string; coverUrl?: string }) => {
    try {
      const res = await fetch(`/api/playlists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setUserPlaylists((prev) => {
          const exists = prev.some((p) => p.id === id);
          if (exists) {
            return prev.map((p) => (p.id === id ? { ...p, ...updated.playlist } : p));
          }
          return [updated.playlist, ...prev];
        });
        showToast("Playlist updated", "success");
        return true;
      }
    } catch {
      showToast("Failed to update playlist", "error");
    }
    return false;
  };

  const deletePlaylist = async (id: string) => {
    try {
      const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUserPlaylists((prev) => prev.filter((p) => p.id !== id));
        showToast("Playlist deleted", "info");
        router.push("/");
        return true;
      }
    } catch {
      showToast("Failed to delete playlist", "error");
    }
    return false;
  };

  const addTrackToPlaylist = async (playlistId: string, trackId: string) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      });
      if (res.ok) {
        showToast("Added to playlist", "success");
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || "Could not add track", "info");
      }
    } catch {
      showToast("Failed to add track", "error");
    }
    return false;
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Removed from playlist", "info");
        return true;
      }
    } catch {
      showToast("Failed to remove track", "error");
    }
    return false;
  };

  const reorderPlaylistTracks = async (playlistId: string, trackId: string, newPosition: number) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, newPosition }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const toggleFollowArtist = async (artistId: string, artistData?: any) => {
    if (!user) {
      showToast("Please log in to follow artists", "info");
      return false;
    }
    const wasFollowed = followedArtistIds.has(artistId);
    const newSet = new Set(followedArtistIds);

    if (wasFollowed) {
      newSet.delete(artistId);
      setFollowedArtists((prev) => prev.filter((a) => a.id !== artistId));
      showToast("Unfollowed artist", "info");
    } else {
      newSet.add(artistId);
      if (artistData) {
        setFollowedArtists((prev) => [artistData, ...prev.filter((a) => a.id !== artistId)]);
      }
      showToast("Followed artist", "success");
    }
    setFollowedArtistIds(newSet);

    try {
      if (wasFollowed) {
        const res = await fetch(`/api/me/following/artists?artistId=${encodeURIComponent(artistId)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to unfollow");
      } else {
        const res = await fetch("/api/me/following/artists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artistId, artist: artistData }),
        });
        if (!res.ok) throw new Error("Failed to follow");
        const data = await res.json();
        if (data.artist) {
          setFollowedArtists((prev) => [data.artist, ...prev.filter((a) => a.id !== artistId)]);
        }
      }
      return !wasFollowed;
    } catch {
      setFollowedArtistIds(new Set(followedArtistIds));
      showToast("Failed to update followed artist", "error");
      return wasFollowed;
    }
  };

  const toggleSaveAlbum = async (albumId: string, albumData?: any) => {
    if (!user) {
      showToast("Please log in to save albums", "info");
      return false;
    }
    const wasSaved = savedAlbumIds.has(albumId);
    const newSet = new Set(savedAlbumIds);

    if (wasSaved) {
      newSet.delete(albumId);
      setSavedAlbums((prev) => prev.filter((a) => a.id !== albumId));
      showToast("Removed album from Your Library", "info");
    } else {
      newSet.add(albumId);
      if (albumData) {
        setSavedAlbums((prev) => [albumData, ...prev.filter((a) => a.id !== albumId)]);
      }
      showToast("Saved album to Your Library", "success");
    }
    setSavedAlbumIds(newSet);

    try {
      if (wasSaved) {
        const res = await fetch(`/api/me/likes/albums?albumId=${encodeURIComponent(albumId)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove album");
      } else {
        const res = await fetch("/api/me/likes/albums", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ albumId, album: albumData }),
        });
        if (!res.ok) throw new Error("Failed to save album");
        const data = await res.json();
        if (data.album) {
          setSavedAlbums((prev) => [data.album, ...prev.filter((a) => a.id !== albumId)]);
        }
      }
      return !wasSaved;
    } catch {
      setSavedAlbumIds(new Set(savedAlbumIds));
      showToast("Failed to update saved album", "error");
      return wasSaved;
    }
  };

  return (
    <LibraryContext.Provider
      value={{
        likedTrackIds,
        likedTracks,
        userPlaylists,
        followedArtistIds,
        followedArtists,
        savedAlbumIds,
        savedAlbums,
        isLoading,
        toggleLikeTrack,
        isTrackLiked,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        reorderPlaylistTracks,
        toggleFollowArtist,
        isArtistFollowed,
        toggleSaveAlbum,
        isAlbumSaved,
        refreshLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("useLibrary must be used within LibraryProvider");
  return context;
}
