"use client";

import React, { useState } from "react";
import { usePlayer, usePlayerProgress } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useUI } from "@/contexts/UIContext";
import { formatDuration } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  Heart,
  ListMusic,
  Mic2,
  Maximize2,
  MonitorSpeaker,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FullScreenPlayerModal } from "./FullScreenPlayerModal";

export function PlayerBar() {
  const router = useRouter();
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    togglePlayPause,
    setVolume,
    toggleMute,
    nextTrack,
    previousTrack,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const { currentTime, duration, seekTo } = usePlayerProgress();

  const { isTrackLiked, toggleLikeTrack } = useLibrary();
  const { toggleRightDrawer, rightDrawerView, isRightDrawerOpen } = useUI();

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekVal, setSeekVal] = useState(0);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  if (!currentTrack) {
    // When no song has been played yet, render empty placeholder bar or first cue
    return null;
  }

  const liked = isTrackLiked(currentTrack.id);
  const effectiveTime = isSeeking ? seekVal : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;
  const volumePercent = isMuted ? 0 : volume * 100;

  return (
    <>
      {/* Full-Screen Now-Playing Modal for Mobile */}
      <FullScreenPlayerModal
        isOpen={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
      />

      {/* 1. Mobile Floating Mini-Player (Visible on mobile only, sits above BottomNav) */}
      <div
        data-testid="mobile-mini-player"
        onClick={() => setIsFullPlayerOpen(true)}
        className="md:hidden fixed bottom-[68px] left-2 right-2 h-14 bg-[#212121] hover:bg-[#282828] active:bg-[#1a1a1a] rounded-md shadow-2xl flex items-center justify-between px-2.5 z-40 select-none cursor-pointer overflow-hidden border border-white/5 transition-colors"
      >
        {/* Track Thumbnail & Details */}
        <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
          <div className="w-10 h-10 rounded bg-[#282828] overflow-hidden shrink-0 shadow-sm relative">
            <img
              src={currentTrack.album?.coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop"}
              alt={currentTrack.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-bold text-white truncate">
              {currentTrack.title}
            </span>
            <span className="text-[11px] text-[#b3b3b3] truncate">
              {currentTrack.artist?.name || "Unknown Artist"}
            </span>
          </div>
        </div>

        {/* Action Buttons: Like & Play/Pause */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleLikeTrack(currentTrack)}
            className="p-2 text-[#b3b3b3] hover:text-white active:scale-90 transition-transform"
            title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          >
            <Heart
              size={18}
              className={liked ? "fill-spotify-green text-spotify-green" : ""}
            />
          </button>

          <button
            onClick={togglePlayPause}
            className="p-2 text-white active:scale-90 transition-transform"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={22} className="fill-current" />
            ) : (
              <Play size={22} className="fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Ultra-thin Bottom Progress Line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
          <div
            className="h-full bg-white transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 2. Desktop Full-Width Player Bar (Visible on desktop screens md+) */}
      <footer className="hidden md:flex h-20 md:h-[90px] bg-black border-t border-[#282828] px-4 items-center justify-between select-none z-50 fixed bottom-0 left-0 right-0">
      {/* 1. Left: Current Track Info & Like */}
      <div className="flex items-center gap-3 w-1/4 min-w-[180px]">
        <div className="w-14 h-14 rounded bg-[#282828] overflow-hidden shrink-0 shadow-md relative group">
          <img
            src={currentTrack.album?.coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop"}
            alt={currentTrack.title}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop";
            }}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex flex-col overflow-hidden mr-2">
          <Link
            href={`/album/${currentTrack.albumId || currentTrack.album?.id || `alb_${(currentTrack.album?.title || currentTrack.title).toLowerCase().replace(/[^a-z0-9]/g, "_")}`}`}
            className="text-sm font-semibold text-white hover:underline truncate"
          >
            {currentTrack.title}
          </Link>
          <div className="flex items-center text-xs text-[#b3b3b3] truncate">
            {(currentTrack.artist?.name || "Unknown Artist")
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
              .map((name, i, arr) => {
                const artId =
                  (i === 0 && (currentTrack.artistId || currentTrack.artist?.id)) ||
                  `art_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
                return (
                  <React.Fragment key={`${artId}_${i}`}>
                    <Link
                      href={`/artist/${artId}`}
                      className="hover:text-white hover:underline truncate"
                    >
                      {name}
                    </Link>
                    {i < arr.length - 1 && <span className="text-[#777] mr-1">,</span>}
                  </React.Fragment>
                );
              })}
          </div>
        </div>

        <button
          onClick={() => toggleLikeTrack(currentTrack)}
          className="text-[#b3b3b3] hover:text-white transition-all p-1 hover:scale-110 active:scale-90"
          title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          data-testid="player-like-button"
        >
          <Heart
            size={18}
            className={liked ? "fill-spotify-green text-spotify-green" : ""}
          />
        </button>
      </div>

      {/* 2. Center: Playback Controls & Progress Bar */}
      <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-[720px]">
        {/* Buttons Row */}
        <div className="flex items-center gap-5">
          {/* Shuffle Button */}
          <button
            onClick={toggleShuffle}
            className={`relative p-1 transition-colors ${
              isShuffle ? "text-spotify-green" : "text-[#b3b3b3] hover:text-white"
            }`}
            title="Enable shuffle (Ctrl + S)"
          >
            <Shuffle size={18} />
            {isShuffle && (
              <span className="w-1 h-1 bg-spotify-green rounded-full absolute -bottom-1 left-1/2 -translate-x-1/2" />
            )}
          </button>

          {/* Previous Track */}
          <button
            onClick={previousTrack}
            className="text-[#b3b3b3] hover:text-white transition-colors p-1"
            title="Previous (Ctrl + Left)"
          >
            <SkipBack size={20} className="fill-current" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={togglePlayPause}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-106 active:scale-98 transition-transform shadow-md"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause size={20} className="fill-current" />
            ) : (
              <Play size={20} className="fill-current ml-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            className="text-[#b3b3b3] hover:text-white transition-colors p-1"
            title="Next (Ctrl + Right)"
          >
            <SkipForward size={20} className="fill-current" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={cycleRepeat}
            className={`relative p-1 transition-colors ${
              repeatMode !== "off" ? "text-spotify-green" : "text-[#b3b3b3] hover:text-white"
            }`}
            title="Repeat mode (Ctrl + R)"
          >
            {repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
            {repeatMode !== "off" && (
              <span className="w-1 h-1 bg-spotify-green rounded-full absolute -bottom-1 left-1/2 -translate-x-1/2" />
            )}
          </button>
        </div>

        {/* Timeline Slider Row */}
        <div className="w-full flex items-center gap-2 text-xs font-mono text-[#b3b3b3]">
          <span className="w-10 text-right">{formatDuration(effectiveTime)}</span>

          <div className="relative flex-1 group flex items-center h-4">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={effectiveTime}
              onMouseDown={() => setIsSeeking(true)}
              onTouchStart={() => setIsSeeking(true)}
              onChange={(e) => setSeekVal(parseFloat(e.target.value))}
              onMouseUp={() => {
                setIsSeeking(false);
                seekTo(seekVal);
              }}
              onTouchEnd={() => {
                setIsSeeking(false);
                seekTo(seekVal);
              }}
              className="w-full h-1 bg-[#4d4d4d] rounded-sm appearance-none cursor-pointer"
            />
            {/* Visual Progress Fill */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white group-hover:bg-spotify-green rounded-sm pointer-events-none transition-colors"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <span className="w-10 text-left">{formatDuration(duration)}</span>
        </div>
      </div>

      {/* 3. Right: Utility & Volume Controls */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[180px]">
        {/* Synchronized Lyrics Toggle */}
        <button
          onClick={() => router.push("/lyrics")}
          className="text-[#b3b3b3] hover:text-white transition-colors p-1"
          title="Lyrics"
        >
          <Mic2 size={18} />
        </button>

        {/* Queue Drawer Toggle */}
        <button
          onClick={() => toggleRightDrawer("queue")}
          className={`p-1 transition-colors ${
            isRightDrawerOpen && rightDrawerView === "queue"
              ? "text-spotify-green"
              : "text-[#b3b3b3] hover:text-white"
          }`}
          title="Queue"
        >
          <ListMusic size={18} />
        </button>

        {/* Volume Mute & Slider */}
        <div className="flex items-center gap-2 w-32 group">
          <button onClick={toggleMute} className="text-[#b3b3b3] hover:text-white transition-colors p-1" title="Mute (M)">
            {isMuted || volume === 0 ? (
              <VolumeX size={18} />
            ) : volume < 0.5 ? (
              <Volume1 size={18} />
            ) : (
              <Volume2 size={18} />
            )}
          </button>

          <div className="relative flex-1 flex items-center h-4">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#4d4d4d] rounded-sm appearance-none cursor-pointer"
            />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white group-hover:bg-spotify-green rounded-sm pointer-events-none transition-colors"
              style={{ width: `${volumePercent}%` }}
            />
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
