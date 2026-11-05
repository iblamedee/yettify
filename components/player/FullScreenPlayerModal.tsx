"use client";

import React, { useState } from "react";
import { usePlayer, usePlayerProgress } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { formatDuration } from "@/lib/utils";
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Mic2,
  ListMusic,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AudioQualityBadge } from "./AudioQualityBadge";

interface FullScreenPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FullScreenPlayerModal({ isOpen, onClose }: FullScreenPlayerModalProps) {
  const router = useRouter();
  const {
    currentTrack,
    isPlaying,
    isShuffle,
    repeatMode,
    playbackQuality,
    togglePlayPause,
    nextTrack,
    previousTrack,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const { currentTime, duration, seekTo } = usePlayerProgress();
  const { isTrackLiked, toggleLikeTrack } = useLibrary();

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekVal, setSeekVal] = useState(0);

  if (!isOpen || !currentTrack) return null;

  const liked = isTrackLiked(currentTrack.id);
  const effectiveTime = isSeeking ? seekVal : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSeeking(true);
    setSeekVal(parseFloat(e.target.value));
  };

  const handleSeekCommit = () => {
    seekTo(seekVal);
    setIsSeeking(false);
  };

  return (
    <div
      data-testid="full-screen-player-modal"
      className="fixed inset-0 bg-gradient-to-b from-[#382626] via-[#1a1212] to-black z-50 flex flex-col p-6 animate-in slide-in-from-bottom duration-300 select-none overflow-hidden"
    >
      {/* 1. Header Bar: Collapse Chevron & Context Info */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <button
          onClick={onClose}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-transform"
          aria-label="Collapse player"
        >
          <ChevronDown size={28} />
        </button>

        <div className="flex flex-col items-center overflow-hidden max-w-[200px]">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#b3b3b3]">
            Playing from
          </span>
          <span className="text-xs font-bold text-white truncate">
            {currentTrack.album?.title || "Album"}
          </span>
        </div>

        <div className="w-10" />
      </div>

      {/* 2. Large Album Artwork */}
      <div className="flex-1 flex items-center justify-center py-4">
        <div className="w-full max-w-[340px] aspect-square rounded-lg overflow-hidden shadow-2xl relative bg-[#282828]">
          <img
            src={currentTrack.album?.coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&h=500&fit=crop"}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* 3. Track Info & Like Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col overflow-hidden mr-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <h2 className="text-xl font-black text-white truncate leading-tight">
              {currentTrack.title}
            </h2>
            <AudioQualityBadge tier={playbackQuality} testId="fullscreen-quality-badge" />
          </div>
          <span className="text-sm font-semibold text-[#b3b3b3] truncate mt-0.5">
            {currentTrack.artist?.name || "Unknown Artist"}
          </span>
        </div>

        <button
          onClick={() => toggleLikeTrack(currentTrack)}
          className="p-2 -mr-2 text-[#b3b3b3] hover:text-white active:scale-90 transition-transform"
          title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
        >
          <Heart
            size={24}
            className={liked ? "fill-spotify-green text-spotify-green" : ""}
          />
        </button>
      </div>

      {/* 4. Touch Scrubber Slider & Timing Labels */}
      <div className="space-y-1 mb-4">
        <div className="relative flex items-center h-5">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={effectiveTime}
            onChange={handleSeekChange}
            onMouseUp={handleSeekCommit}
            onTouchEnd={handleSeekCommit}
            className="w-full h-1 bg-[#4d4d4d] rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-[#b3b3b3]">
          <span>{formatDuration(effectiveTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* 5. Main Playback Controls Row */}
      <div className="flex items-center justify-between mb-6 px-2">
        <button
          onClick={toggleShuffle}
          className={`p-2 transition-colors ${
            isShuffle ? "text-spotify-green" : "text-[#b3b3b3]"
          }`}
          title="Shuffle"
        >
          <Shuffle size={20} />
        </button>

        <button
          onClick={previousTrack}
          className="p-2 text-white active:scale-90 transition-transform"
          title="Previous"
        >
          <SkipBack size={28} className="fill-white" />
        </button>

        <button
          onClick={togglePlayPause}
          className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center active:scale-95 shadow-xl transition-transform"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={28} className="fill-black" />
          ) : (
            <Play size={28} className="fill-black ml-1" />
          )}
        </button>

        <button
          onClick={nextTrack}
          className="p-2 text-white active:scale-90 transition-transform"
          title="Next"
        >
          <SkipForward size={28} className="fill-white" />
        </button>

        <button
          onClick={cycleRepeat}
          className={`p-2 transition-colors ${
            repeatMode !== "off" ? "text-spotify-green" : "text-[#b3b3b3]"
          }`}
          title="Repeat"
        >
          {repeatMode === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </button>
      </div>

      {/* 6. Footer Quick Actions: Lyrics & Queue */}
      <div className="flex items-center justify-between pt-2 pb-4 text-[#b3b3b3]">
        <button
          onClick={() => {
            onClose();
            router.push("/lyrics");
          }}
          className="flex items-center gap-1.5 text-xs font-bold hover:text-white active:scale-95 transition-transform"
        >
          <Mic2 size={18} />
          <span>Lyrics</span>
        </button>

        <button
          onClick={() => {
            onClose();
            router.push("/queue");
          }}
          className="flex items-center gap-1.5 text-xs font-bold hover:text-white active:scale-95 transition-transform"
        >
          <ListMusic size={18} />
          <span>Queue</span>
        </button>
      </div>
    </div>
  );
}
