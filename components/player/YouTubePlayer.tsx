"use client";

import React, { useState, useCallback } from "react";
import {
  useYouTubePlayer,
  YouTubePlayerError,
  YouTubePlaybackState,
} from "@/hooks/useYouTubePlayer";
import { Minimize2, Maximize2, X, AlertCircle, ExternalLink } from "lucide-react";

export interface YouTubePlayerProps {
  videoId: string | null;
  mode?: "inline" | "docked" | "audio-compliant";
  autoPlay?: boolean;
  controls?: boolean;
  initialVolume?: number;
  initialMuted?: boolean;
  title?: string;
  artist?: string;
  className?: string;
  onReady?: (player: any) => void;
  onStateChange?: (state: YouTubePlaybackState, rawState: number) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onError?: (error: YouTubePlayerError) => void;
  onEnded?: () => void;
  onClose?: () => void;
}

export function YouTubePlayer({
  videoId,
  mode = "docked",
  autoPlay = true,
  controls = true,
  initialVolume = 100,
  initialMuted = false,
  title,
  artist,
  className = "",
  onReady,
  onStateChange,
  onProgress,
  onError,
  onEnded,
  onClose,
}: YouTubePlayerProps) {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [hasError, setHasError] = useState<YouTubePlayerError | null>(null);

  const handleError = useCallback(
    (err: YouTubePlayerError) => {
      setHasError(err);
      onError?.(err);
    },
    [onError]
  );

  const {
    containerRef,
    isReady,
    isPlaying,
    playbackState,
    currentTime,
    duration,
    playVideo,
    pauseVideo,
    seekTo,
    setVolume,
    isMuted,
    toggleMute,
  } = useYouTubePlayer({
    videoId,
    autoPlay,
    controls,
    initialVolume,
    initialMuted,
    onReady,
    onStateChange: (state, raw) => {
      setHasError(null);
      onStateChange?.(state, raw);
    },
    onProgress,
    onError: handleError,
    onEnded,
  });

  // Calculate layout classes based on mode and browser compliance rules
  // Rule: Chrome and Safari require minimum 200x200px dimensions to avoid background media throttling
  let modeClasses = "";
  if (mode === "docked") {
    modeClasses = isMinimized
      ? "fixed bottom-20 md:bottom-24 right-4 w-[200px] h-[120px] z-50 rounded-lg shadow-2xl border border-white/20 bg-black transition-all duration-300"
      : "fixed bottom-20 md:bottom-24 right-4 w-[280px] h-[168px] md:w-[360px] md:h-[216px] z-50 rounded-xl shadow-2xl border border-white/20 bg-black transition-all duration-300";
  } else if (mode === "audio-compliant") {
    // Audio-compliant mode: ensures browser policies recognize media presence while remaining compact
    modeClasses =
      "fixed bottom-20 md:bottom-24 right-4 min-w-[200px] min-h-[200px] w-[200px] h-[200px] z-40 rounded-xl shadow-2xl border border-white/10 bg-black overflow-hidden pointer-events-auto";
  } else {
    // Inline mode: standard container respecting minimum 200px constraints
    modeClasses = "relative w-full aspect-video min-w-[200px] min-h-[200px] rounded-lg overflow-hidden bg-black";
  }

  if (!videoId) {
    return null;
  }

  return (
    <div
      data-testid="youtube-player-wrapper"
      className={`group select-none ${modeClasses} ${className}`}
      aria-label={title ? `YouTube player playing ${title}` : "YouTube player"}
    >
      {/* Header toolbar for docked mode */}
      {mode === "docked" && (
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/80 to-transparent px-2 flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {title && (
              <span className="text-xs font-medium text-white truncate max-w-[140px] md:max-w-[200px]">
                {title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized((prev) => !prev)}
              className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              title={isMinimized ? "Expand mini player" : "Minimize mini player"}
              aria-label={isMinimized ? "Expand mini player" : "Minimize mini player"}
            >
              {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded text-white/80 hover:text-white hover:bg-red-500/50 transition-colors"
                title="Close video"
                aria-label="Close video"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unmanaged React DOM container for the YouTube Player iframe */}
      <div
        ref={containerRef}
        data-testid="youtube-unmanaged-container"
        className="w-full h-full"
      />

      {/* Error Overlay for Restricted (101/150/153) or Broken Videos */}
      {hasError && (
        <div
          data-testid="youtube-error-overlay"
          className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-3 text-center z-30 space-y-1.5"
        >
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <p className="text-xs font-semibold text-white">
            {hasError.isRestricted
              ? "Embedding restricted by copyright owner"
              : "Playback Error"}
          </p>
          <p className="text-[10px] text-gray-400 line-clamp-2 max-w-[90%]">
            {hasError.message}
          </p>
          {videoId && (
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium bg-spotify-green hover:bg-spotify-green-highlight text-black px-3 py-1 rounded-full transition-transform active:scale-95 inline-flex items-center gap-1 mt-1"
            >
              Listen on YouTube <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
