"use client";

import React, { useEffect, useState } from "react";
import { Track } from "@/types";
import { usePlayer } from "@/contexts/PlayerContext";
import { useUI } from "@/contexts/UIContext";
import { Play, Pause, RefreshCw, Plus, Check } from "lucide-react";

interface PlaylistRecommendationsProps {
  playlistId: string;
  onTrackAdded?: (track: Track) => void;
}

export function PlaylistRecommendations({
  playlistId,
  onTrackAdded,
}: PlaylistRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();
  const { showToast } = useUI();

  const fetchRecommendations = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/recommendations/playlist/${playlistId}?limit=8`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.tracks || []);
      }
    } catch (err) {
      console.error("Failed to load playlist recommendations:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (playlistId) {
      fetchRecommendations();
    }
  }, [playlistId]);

  const handleAddTrack = async (track: Track) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id, track }),
      });

      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(track.id));
        showToast(`Added "${track.title}" to playlist`, "success");
        if (onTrackAdded) {
          onTrackAdded(track);
        }
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to add track", "error");
      }
    } catch {
      showToast("Failed to add track", "error");
    }
  };

  if (loading) {
    return (
      <div className="mt-12 pt-8 border-t border-[#282828] animate-pulse">
        <div className="h-6 w-48 bg-[#282828] rounded mb-2" />
        <div className="h-4 w-64 bg-[#282828] rounded mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-[#181818] rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-[#282828]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-white">Recommended</h3>
          <p className="text-xs text-[#b3b3b3] mt-1">Based on what's in this playlist</p>
        </div>

        <button
          onClick={fetchRecommendations}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white hover:scale-105 transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Recommended Track Rows */}
      <div className="space-y-1">
        {recommendations.map((track) => {
          const isCurrent = currentTrack?.id === track.id;
          const isRowPlaying = isCurrent && isPlaying;
          const isAdded = addedIds.has(track.id);

          return (
            <div
              key={track.id}
              className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[#282828]/60 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Thumbnail & Play Overlay */}
                <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden">
                  <img
                    src={track.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop"}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => {
                      if (isCurrent) togglePlayPause();
                      else playTrack(track, recommendations);
                    }}
                    className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
                      isRowPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {isRowPlaying ? (
                      <Pause size={16} className="text-white fill-white" />
                    ) : (
                      <Play size={16} className="text-white fill-white ml-0.5" />
                    )}
                  </button>
                </div>

                {/* Track Title and Artist */}
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-semibold truncate ${
                      isCurrent ? "text-spotify-green" : "text-white"
                    }`}
                  >
                    {track.title}
                  </div>
                  <div className="text-xs text-[#b3b3b3] truncate">
                    {track.artist?.name || "Various Artists"}
                  </div>
                </div>

                {/* Album Name (hidden on small screens) */}
                <div className="hidden md:block w-1/3 text-xs text-[#b3b3b3] truncate">
                  {track.album?.title || track.title}
                </div>
              </div>

              {/* Add Action Button */}
              <div className="ml-4 shrink-0">
                {isAdded ? (
                  <span className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-spotify-green">
                    <Check size={14} /> Added
                  </span>
                ) : (
                  <button
                    onClick={() => handleAddTrack(track)}
                    className="flex items-center gap-1 px-3.5 py-1 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus size={14} /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
