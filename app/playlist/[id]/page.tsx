"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { MediaHeader } from "@/components/media/MediaHeader";
import { TrackTable } from "@/components/track/TrackTable";
import { PlaylistRecommendations } from "@/components/playlist/PlaylistRecommendations";
import { useUI } from "@/contexts/UIContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { Playlist, Track } from "@/types";

export default function PlaylistPage() {
  const params = useParams();
  const playlistId = params.id as string;
  const router = useRouter();

  const { openModal } = useUI();
  const { user } = useAuth();
  const { userPlaylists, removeTrackFromPlaylist } = useLibrary();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync with LibraryContext when updated
  const activePlaylist = userPlaylists.find((p) => p.id === playlistId) || playlist;

  useEffect(() => {
    const found = userPlaylists.find((p) => p.id === playlistId);
    if (found && playlist && (found.title !== playlist.title || found.description !== playlist.description || found.coverUrl !== playlist.coverUrl)) {
      setPlaylist((prev) => (prev ? { ...prev, title: found.title, description: found.description, coverUrl: found.coverUrl } : prev));
    }
  }, [userPlaylists, playlistId, playlist]);

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  const fetchPlaylist = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/playlists/${playlistId}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data.playlist);
      } else {
        router.push("/");
      }
    } catch {
      router.push("/");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !activePlaylist) {
    return <div className="py-20 text-center text-[#b3b3b3]">Loading playlist...</div>;
  }

  const tracks: Track[] = (playlist?.tracks || []).map((pt: any) => pt.track);
  const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const isOwner = user && user.id === activePlaylist.ownerId;

  const handleRemoveTrack = async (trackId: string) => {
    const ok = await removeTrackFromPlaylist(playlistId, trackId);
    if (ok) {
      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks?.filter((pt) => pt.track.id !== trackId),
            }
          : null
      );
    }
  };

  return (
    <div className="pb-16">
      {/* Header */}
      <MediaHeader
        type="Playlist"
        title={activePlaylist.title}
        coverUrl={activePlaylist.coverUrl}
        creatorName={activePlaylist.owner?.displayName || "Spotify"}
        creatorAvatar={activePlaylist.owner?.avatarUrl}
        creatorId={activePlaylist.ownerId}
        creatorType="user"
        trackCount={tracks.length}
        totalDurationSeconds={totalSeconds}
        tracks={tracks}
        onEdit={isOwner ? () => openModal("edit-playlist", activePlaylist) : undefined}
        gradientColor="rgba(80, 50, 100, 0.7)"
      />

      {activePlaylist.description && (
        <p className="text-sm text-[#b3b3b3] mb-6 px-1">{activePlaylist.description}</p>
      )}

      {/* Tracks Table */}
      <TrackTable
        tracks={tracks}
        showAlbum={true}
        showDateAdded={true}
        playlistId={playlistId}
        onRemoveTrack={isOwner ? handleRemoveTrack : undefined}
      />

      {/* Recommended Songs Section */}
      <PlaylistRecommendations
        playlistId={playlistId}
        onTrackAdded={(newTrack) => {
          setPlaylist((prev) =>
            prev
              ? {
                  ...prev,
                  tracks: [
                    ...(prev.tracks || []),
                    {
                      id: `pt_${Date.now()}`,
                      playlistId,
                      trackId: newTrack.id,
                      position: (prev.tracks || []).length,
                      addedAt: new Date().toISOString(),
                      track: newTrack,
                    },
                  ],
                }
              : null
          );
        }}
      />
    </div>
  );
}
