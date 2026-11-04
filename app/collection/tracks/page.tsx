"use client";

import React, { useState, useEffect, useMemo } from "react";
import { TrackTable } from "@/components/track/TrackTable";
import { useAuth } from "@/contexts/AuthContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDurationWords } from "@/lib/utils";
import { Track } from "@/types";
import { Heart, Play, Pause, Shuffle, Search, X, ArrowUpDown } from "lucide-react";

type SortOption = "dateAdded" | "title" | "artist" | "album" | "duration";

export default function LikedSongsPage() {
  const { user } = useAuth();
  const { likedTrackIds } = useLibrary();
  const { currentTrack, isPlaying, playTrack, togglePlayPause, toggleShuffle, isShuffle } = usePlayer();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("dateAdded");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetchLikedTracks();
  }, [likedTrackIds.size]);

  const fetchLikedTracks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/me/likes/tracks");
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const totalSeconds = useMemo(
    () => tracks.reduce((acc, t) => acc + (t.duration || 0), 0),
    [tracks]
  );

  // Filter & Sort tracks
  const displayedTracks = useMemo(() => {
    let result = [...tracks];

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist?.name?.toLowerCase().includes(q) ||
          t.album?.title?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "artist":
          cmp = (a.artist?.name || "").localeCompare(b.artist?.name || "");
          break;
        case "album":
          cmp = (a.album?.title || "").localeCompare(b.album?.title || "");
          break;
        case "duration":
          cmp = a.duration - b.duration;
          break;
        case "dateAdded":
        default:
          const dateA = a.likedAt ? new Date(a.likedAt).getTime() : 0;
          const dateB = b.likedAt ? new Date(b.likedAt).getTime() : 0;
          cmp = dateB - dateA;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [tracks, searchFilter, sortBy, sortAsc]);

  const isCurrentListPlaying =
    isPlaying &&
    displayedTracks.length > 0 &&
    displayedTracks.some((t) => t.id === currentTrack?.id);

  const handlePlayLikedSongs = () => {
    if (isCurrentListPlaying) {
      togglePlayPause();
    } else if (displayedTracks.length > 0) {
      playTrack(displayedTracks[0], displayedTracks, 0);
    }
  };

  return (
    <div className="pb-16 select-none">
      {/* 1. Spotify Liked Songs Hero Banner */}
      <div className="relative -mx-6 -mt-2 mb-6">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(70, 15, 245, 0.8) 0%, rgba(18, 18, 18, 0) 100%)",
          }}
        />

        <div className="relative px-6 pt-12 pb-6 flex flex-col md:flex-row items-end gap-6">
          {/* Heart Gradient Cover Artwork */}
          <div className="w-48 h-48 md:w-60 md:h-60 rounded-md bg-gradient-purple flex items-center justify-center shrink-0 shadow-2xl">
            <Heart size={84} className="fill-white text-white drop-shadow-md" />
          </div>

          {/* Title & Metadata */}
          <div className="flex flex-col gap-2 flex-1 overflow-hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-white">Playlist</span>
            <h1 className="font-black text-4xl md:text-7xl tracking-tight text-white truncate">
              Liked Songs
            </h1>
            <div className="flex items-center gap-2 text-xs md:text-sm font-medium text-white flex-wrap mt-2">
              <span className="font-bold">{user?.displayName || "You"}</span>
              <span>•</span>
              <span className="text-[#b3b3b3]">{formatDurationWords(tracks.length, totalSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 2. Spotify Action Toolbar: Play Button, Shuffle, In-playlist Search & Sort */}
        {tracks.length > 0 && (
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              {/* Primary Green Play Button */}
              <button
                onClick={handlePlayLikedSongs}
                data-testid="play-liked-songs-button"
                className="w-14 h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-spotify-play"
                title={isCurrentListPlaying ? "Pause" : "Play"}
                aria-label={isCurrentListPlaying ? "Pause" : "Play"}
              >
                {isCurrentListPlaying ? (
                  <Pause size={26} className="fill-current" />
                ) : (
                  <Play size={26} className="fill-current ml-1" />
                )}
              </button>

              {/* Shuffle Button */}
              <button
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${
                  isShuffle ? "text-spotify-green" : "text-[#b3b3b3] hover:text-white"
                }`}
                title="Shuffle"
                aria-label="Shuffle"
              >
                <Shuffle size={24} />
              </button>
            </div>

            {/* Filter & Sort Controls */}
            <div className="flex items-center gap-3">
              {/* Search in Liked Songs Input */}
              <div className="relative w-48 sm:w-60">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b3b3b3]" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search in Liked Songs"
                  data-testid="search-liked-songs-input"
                  className="w-full bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#333333] text-xs text-white pl-8 pr-7 py-2 rounded-full placeholder-[#b3b3b3] focus:outline-none transition-colors border border-transparent focus:border-white/20"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 text-xs text-[#b3b3b3] bg-[#242424] px-3 py-1.5 rounded-full">
                <ArrowUpDown size={12} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-xs text-[#b3b3b3] hover:text-white focus:outline-none cursor-pointer"
                  data-testid="sort-liked-songs-select"
                >
                  <option value="dateAdded" className="bg-[#242424] text-white">Date added</option>
                  <option value="title" className="bg-[#242424] text-white">Title</option>
                  <option value="artist" className="bg-[#242424] text-white">Artist</option>
                  <option value="album" className="bg-[#242424] text-white">Album</option>
                  <option value="duration" className="bg-[#242424] text-white">Duration</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Table / Empty States */}
      {isLoading ? (
        <div className="py-20 text-center text-[#b3b3b3]">Loading your liked songs...</div>
      ) : tracks.length === 0 ? (
        <div className="py-24 text-center text-[#b3b3b3] max-w-md mx-auto space-y-3">
          <div className="w-16 h-16 rounded-full bg-[#242424] flex items-center justify-center mx-auto mb-2">
            <Heart size={32} className="text-[#b3b3b3]" />
          </div>
          <h3 className="text-xl font-bold text-white">Songs you like will appear here</h3>
          <p className="text-xs text-[#b3b3b3]">
            Save songs by tapping the heart icon in any playlist, album, or search result.
          </p>
        </div>
      ) : displayedTracks.length === 0 ? (
        <div className="py-20 text-center text-[#b3b3b3]">
          <p className="text-base font-semibold text-white">Couldn&apos;t find &quot;{searchFilter}&quot;</p>
          <p className="text-xs mt-1">Try searching again using a different keyword or spelling.</p>
        </div>
      ) : (
        <TrackTable tracks={displayedTracks} showAlbum={true} showDateAdded={true} />
      )}
    </div>
  );
}
