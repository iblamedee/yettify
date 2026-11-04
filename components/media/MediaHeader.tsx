"use client";

import React, { useState, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDurationWords } from "@/lib/utils";
import { Play, Pause, Heart, MoreHorizontal, CheckCircle2, Disc, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { PlaylistCover } from "@/components/playlist/PlaylistCover";

interface MediaHeaderProps {
  type: "Album" | "Playlist" | "Artist" | "Single";
  title: string;
  coverUrl?: string | null;
  creatorName?: string;
  creatorAvatar?: string | null;
  creatorId?: string;
  creatorType?: "artist" | "user";
  releaseYear?: number;
  trackCount?: number;
  totalDurationSeconds?: number;
  tracks?: any[];
  isVerified?: boolean;
  monthlyListeners?: number;
  onEdit?: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  isFollowed?: boolean;
  onToggleFollow?: () => void;
  gradientColor?: string;
}

export function MediaHeader({
  type,
  title,
  coverUrl,
  creatorName,
  creatorAvatar,
  creatorId,
  creatorType = "artist",
  releaseYear,
  trackCount = 0,
  totalDurationSeconds = 0,
  tracks = [],
  isVerified,
  monthlyListeners,
  onEdit,
  isSaved,
  onToggleSave,
  isFollowed,
  onToggleFollow,
  gradientColor = "rgba(80, 80, 80, 0.6)",
}: MediaHeaderProps) {
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();

  const [hasCoverError, setHasCoverError] = useState(false);

  useEffect(() => {
    setHasCoverError(false);
  }, [coverUrl]);

  const isCurrentHeaderPlaying =
    isPlaying &&
    tracks.length > 0 &&
    tracks.some((t) => t.id === currentTrack?.id);

  const handleHeaderPlay = () => {
    if (isCurrentHeaderPlaying) {
      togglePlayPause();
    } else if (tracks.length > 0) {
      playTrack(tracks[0], tracks, 0);
    }
  };

  const isArtist = type === "Artist";

  return (
    <div className="relative -mx-6 -mt-2 mb-6">
      {/* Dynamic Background Tint */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${gradientColor} 0%, rgba(18, 18, 18, 0) 100%)`,
        }}
      />

      <div className="relative px-4 md:px-6 pt-6 md:pt-12 pb-4 md:pb-6 flex flex-col items-center text-center md:items-end md:text-left md:flex-row gap-4 md:gap-6">
        {/* Artwork Image */}
        <div
          onClick={onEdit}
          className={`shrink-0 shadow-2xl overflow-hidden bg-[#282828] ${
            onEdit ? "cursor-pointer group relative" : ""
          } ${isArtist ? "w-36 h-36 md:w-56 md:h-56 rounded-full" : "w-36 h-36 md:w-60 md:h-60 rounded-md"}`}
        >
          {type === "Playlist" ? (
            <PlaylistCover
              coverUrl={coverUrl}
              tracks={tracks}
              title={title}
              iconSize={64}
              className="w-full h-full"
            />
          ) : coverUrl && !hasCoverError ? (
            <img
              src={coverUrl}
              alt={title}
              loading="lazy"
              decoding="async"
              onError={() => setHasCoverError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#121212] text-[#7a7a7a]">
              {isArtist ? <UserIcon size={64} /> : <Disc size={64} />}
            </div>
          )}

          {onEdit && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold transition-opacity">
              <span>Choose photo</span>
            </div>
          )}
        </div>

        {/* Header Metadata */}
        <div className="flex flex-col gap-2 flex-1 overflow-hidden items-center md:items-start w-full">
          {/* Badge / Type */}
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            {isVerified && (
              <span className="flex items-center gap-1 text-[#3d91f4]">
                <CheckCircle2 size={16} className="fill-current text-white" />
                <span>Verified Artist</span>
              </span>
            )}
            {!isVerified && <span>{type}</span>}
          </div>

          {/* Large Title */}
          <h1
            onClick={onEdit}
            className={`font-black tracking-tight text-white line-clamp-2 ${
              onEdit ? "cursor-pointer hover:underline" : ""
            } ${title.length > 25 ? "text-2xl md:text-5xl" : "text-3xl md:text-7xl"}`}
          >
            {title}
          </h1>

          {/* Stats & Attribution Subtitle */}
          <div className="flex items-center gap-2 text-xs md:text-sm font-medium text-white flex-wrap mt-1">
            {isArtist && monthlyListeners !== undefined ? (
              <span className="text-[#b3b3b3]">
                {new Intl.NumberFormat("en-US").format(monthlyListeners)} monthly listeners
              </span>
            ) : (
              <>
                {creatorName && (
                  <div className="flex items-center gap-1.5 font-bold">
                    {creatorAvatar && (
                      <img
                        src={creatorAvatar}
                        alt={creatorName}
                        loading="lazy"
                        decoding="async"
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    )}
                    {creatorId ? (
                      <Link
                        href={`/${creatorType}/${creatorId}`}
                        className="hover:underline"
                      >
                        {creatorName}
                      </Link>
                    ) : (
                      <span>{creatorName}</span>
                    )}
                    <span>•</span>
                  </div>
                )}

                {releaseYear && (
                  <>
                    <span className="text-[#e0e0e0]">{releaseYear}</span>
                    <span>•</span>
                  </>
                )}

                {trackCount > 0 && (
                  <span className="text-[#b3b3b3]">
                    {formatDurationWords(trackCount, totalDurationSeconds)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Primary Actions Row */}
      <div className="px-6 py-4 flex items-center gap-6">
        {tracks.length > 0 && (
          <button
            onClick={handleHeaderPlay}
            className="w-14 h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-106 active:scale-98 transition-transform shadow-spotify-play"
            title={isCurrentHeaderPlaying ? "Pause" : "Play"}
            aria-label={isCurrentHeaderPlaying ? "Pause" : "Play"}
          >
            {isCurrentHeaderPlaying ? (
              <Pause size={26} className="fill-current" />
            ) : (
              <Play size={26} className="fill-current ml-1" />
            )}
          </button>
        )}

        {isArtist && onToggleFollow && (
          <button
            onClick={onToggleFollow}
            data-testid="artist-follow-button"
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 ${
              isFollowed
                ? "border border-spotify-green text-spotify-green hover:border-white hover:text-white"
                : "border border-white/40 text-white hover:border-white"
            }`}
          >
            {isFollowed ? "Following" : "Follow"}
          </button>
        )}

        {onToggleSave && (
          <button
            onClick={onToggleSave}
            data-testid="media-save-button"
            className="text-[#b3b3b3] hover:text-white transition-all hover:scale-110 active:scale-90"
            title={isSaved ? "Remove from Library" : "Save to Library"}
            aria-label={isSaved ? "Remove from Library" : "Save to Library"}
          >
            <Heart
              size={32}
              className={isSaved ? "fill-spotify-green text-spotify-green" : ""}
            />
          </button>
        )}

        <button className="text-[#b3b3b3] hover:text-white transition-colors" aria-label="More options">
          <MoreHorizontal size={28} />
        </button>
      </div>
    </div>
  );
}
