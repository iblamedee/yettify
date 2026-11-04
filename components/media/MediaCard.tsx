"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Pause, Disc, Music, User as UserIcon } from "lucide-react";
import { PlaylistCover } from "@/components/playlist/PlaylistCover";

interface MediaCardProps {
  id: string;
  type: "album" | "artist" | "playlist" | "track";
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  targetUrl: string;
  playContext?: any; // Track or Album/Playlist to play
  tracks?: any[];
}

export const MediaCard = React.memo(function MediaCard({
  id,
  type,
  title,
  subtitle,
  imageUrl,
  targetUrl,
  playContext,
  tracks,
}: MediaCardProps) {
  const router = useRouter();
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();
  const [hasImgError, setHasImgError] = useState(false);

  useEffect(() => {
    setHasImgError(false);
  }, [imageUrl]);

  const isArtist = type === "artist";
  const isPlayingThis =
    currentTrack &&
    (currentTrack.id === id ||
      currentTrack.albumId === id ||
      currentTrack.artistId === id);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlayingThis) {
      togglePlayPause();
    } else if (playContext) {
      if (Array.isArray(playContext)) {
        playTrack(playContext[0], playContext);
      } else if (playContext.tracks && playContext.tracks.length > 0) {
        playTrack(playContext.tracks[0], playContext.tracks);
      } else {
        playTrack(playContext);
      }
    } else {
      router.push(targetUrl);
    }
  };

  return (
    <div
      onClick={() => router.push(targetUrl)}
      className="p-4 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all duration-200 group cursor-pointer relative flex flex-col select-none"
    >
      {/* Artwork Container */}
      <div
        className={`relative mb-4 w-full aspect-square bg-[#282828] shadow-md overflow-hidden ${
          isArtist ? "rounded-full" : "rounded-md"
        }`}
      >
        {type === "playlist" ? (
          <PlaylistCover
            coverUrl={imageUrl}
            tracks={tracks || playContext}
            title={title}
            iconSize={44}
            className="w-full h-full"
          />
        ) : imageUrl && !hasImgError ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => setHasImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isArtist ? "rounded-full" : "rounded-md"
            }`}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#141414] text-[#777] ${
              isArtist ? "rounded-full" : "rounded-md"
            }`}
          >
            {isArtist ? (
              <UserIcon size={44} />
            ) : type === "album" ? (
              <Disc size={44} />
            ) : (
              <Music size={44} />
            )}
          </div>
        )}

        {/* Floating Green Play Button Overlay */}
        <button
          onClick={handlePlayClick}
          className={`absolute right-2 bottom-2 w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-spotify-play hover:scale-106 active:scale-98 transition-all duration-300 ${
            isPlayingThis && isPlaying
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
          }`}
          title={isPlayingThis && isPlaying ? "Pause" : "Play"}
        >
          {isPlayingThis && isPlaying ? (
            <Pause size={22} className="fill-current" />
          ) : (
            <Play size={22} className="fill-current ml-0.5" />
          )}
        </button>
      </div>

      {/* Title & Subtitle */}
      <div className="flex flex-col">
        <h4 className="text-sm font-bold text-white truncate mb-1" title={title}>
          {title}
        </h4>
        {subtitle && (
          <p className="text-xs text-[#b3b3b3] line-clamp-2 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
});
