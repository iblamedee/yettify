"use client";

import React from "react";
import { Track } from "@/types";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useUI } from "@/contexts/UIContext";
import { formatDuration, formatDateAdded } from "@/lib/utils";
import { Play, Pause, Heart, MoreHorizontal, ListPlus, PlusCircle, Trash2, Radio } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TrackRowProps {
  track: Track;
  index: number;
  contextList?: Track[];
  addedAt?: string;
  showAlbum?: boolean;
  showDateAdded?: boolean;
  onRemove?: () => void;
  playlistId?: string;
}

export const TrackRow = React.memo(function TrackRow({
  track,
  index,
  contextList,
  addedAt,
  showAlbum = true,
  showDateAdded = false,
  onRemove,
  playlistId,
}: TrackRowProps) {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, addToQueue, playNext } = usePlayer();
  const { isTrackLiked, toggleLikeTrack, userPlaylists, addTrackToPlaylist } = useLibrary();
  const { showContextMenu, showToast } = useUI();
  const router = useRouter();

  const isCurrent = currentTrack?.id === track.id;
  const isRowPlaying = isCurrent && isPlaying;
  const liked = isTrackLiked(track.id);

  const handlePlayClick = () => {
    if (isCurrent) {
      togglePlayPause();
    } else {
      playTrack(track, contextList, index);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const playlistSubmenu = userPlaylists.map((pl) => ({
      label: pl.title,
      onClick: () => addTrackToPlaylist(pl.id, track.id),
    }));

    showContextMenu(
      e,
      [
        {
          label: isRowPlaying ? "Pause" : "Play",
          icon: <Play size={16} />,
          onClick: handlePlayClick,
        },
        {
          label: liked ? "Remove from your Liked Songs" : "Save to your Liked Songs",
          icon: <Heart size={16} className={liked ? "fill-spotify-green text-spotify-green" : ""} />,
          onClick: () => toggleLikeTrack(track),
        },
        {
          label: "Add to queue",
          icon: <ListPlus size={16} />,
          onClick: () => {
            addToQueue(track);
            showToast("Added to queue", "info");
          },
        },
        {
          label: "Play next",
          icon: <Play size={16} />,
          onClick: () => {
            playNext(track);
            showToast("Will play next", "info");
          },
        },
        {
          label: "Go to song radio",
          icon: <Radio size={16} />,
          onClick: () => {
            router.push(`/radio/track/${track.id}`);
          },
        },
        {
          label: "Go to artist radio",
          icon: <Radio size={16} />,
          onClick: () => {
            router.push(`/radio/artist/${track.artist?.id || track.artist?.name}`);
          },
        },
        { divider: true, label: "", onClick: () => {} },
        ...playlistSubmenu.slice(0, 5).map((item) => ({
          label: `Add to: ${item.label}`,
          icon: <PlusCircle size={16} />,
          onClick: item.onClick,
        })),
        ...(onRemove
          ? [
              { divider: true, label: "", onClick: () => {} },
              {
                label: "Remove from this playlist",
                destructive: true,
                icon: <Trash2 size={16} />,
                onClick: () => onRemove(),
              },
            ]
          : []),
      ],
      track
    );
  };

  return (
    <div
      data-testid="track-row"
      onClick={handlePlayClick}
      onContextMenu={handleContextMenu}
      className={`flex md:grid items-center py-2 px-2 md:px-4 rounded-md text-sm text-[#b3b3b3] hover:bg-white/10 group transition-colors select-none cursor-pointer ${
        isCurrent ? "bg-white/5" : ""
      }`}
      style={{
        gridTemplateColumns: showAlbum && showDateAdded
          ? "40px 4fr 3fr 2fr 40px 60px 40px"
          : showAlbum
          ? "40px 6fr 4fr 40px 60px 40px"
          : "40px 8fr 40px 60px 40px",
      }}
    >
      {/* 1. Track Index / Play Button (Desktop only) */}
      <div className="hidden md:flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePlayClick();
          }}
          aria-label={isRowPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-spotify-green transition-colors"
        >
          {isRowPlaying ? (
            <Pause size={16} className="fill-current text-spotify-green" />
          ) : (
            <>
              <span className={`group-hover:hidden ${isCurrent ? "text-spotify-green font-bold" : ""}`}>
                {index + 1}
              </span>
              <Play size={14} className="fill-current hidden group-hover:inline ml-0.5" />
            </>
          )}
        </button>
      </div>

      {/* 2. Title & Artist (+ thumbnail) */}
      <div className="flex-1 flex items-center gap-3 overflow-hidden pr-2 md:pr-4">
        {track.album?.coverUrl && (
          <img
            src={track.album.coverUrl}
            alt={track.title}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop";
            }}
            className="w-10 h-10 rounded object-cover shrink-0"
          />
        )}
        <div className="flex flex-col overflow-hidden">
          <span
            className={`font-medium truncate transition-colors ${
              isCurrent ? "text-spotify-green font-bold" : "text-white"
            }`}
          >
            {track.title}
          </span>
          <div className="flex items-center gap-1 text-xs text-[#b3b3b3] truncate">
            {track.explicit && (
              <span className="bg-[#535353] text-[#121212] px-1 rounded text-[9px] font-bold mr-0.5">
                E
              </span>
            )}
            {(track.artist?.name || "Unknown Artist")
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
              .map((name, i, arr) => {
                const artId =
                  (i === 0 && (track.artistId || track.artist?.id)) ||
                  `art_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
                return (
                  <React.Fragment key={`${artId}_${i}`}>
                    <Link
                      href={`/artist/${artId}`}
                      className="hover:text-white hover:underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {name}
                    </Link>
                    {i < arr.length - 1 && <span className="text-[#777] mr-1">,</span>}
                  </React.Fragment>
                );
              })}
          </div>
        </div>
      </div>

      {/* 3. Album */}
      {showAlbum && (
        <div className="overflow-hidden pr-4 hidden md:block">
          <Link
            href={`/album/${track.albumId}`}
            className="text-xs text-[#b3b3b3] hover:text-white hover:underline truncate inline-block max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {track.album?.title || "Unknown Album"}
          </Link>
        </div>
      )}

      {/* 4. Date Added */}
      {showDateAdded && (
        <div className="text-xs text-[#b3b3b3] pr-4 hidden lg:block">
          {addedAt ? formatDateAdded(addedAt) : "Recently"}
        </div>
      )}

      {/* 5. Like Heart Button (Desktop/Tablet) */}
      <div className="hidden sm:flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLikeTrack(track);
          }}
          className={`p-1 transition-all hover:scale-110 active:scale-90 ${
            liked ? "text-spotify-green" : "text-[#b3b3b3] opacity-0 group-hover:opacity-100 hover:text-white"
          }`}
          title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          data-testid="track-like-button"
        >
          <Heart size={16} className={liked ? "fill-spotify-green" : ""} />
        </button>
      </div>

      {/* 6. Duration (Desktop only) */}
      <div className="text-xs text-right font-mono pr-2 hidden md:block">
        {formatDuration(track.duration)}
      </div>

      {/* 7. Context Menu Trigger (Always touch-friendly on mobile) */}
      <div className="flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleContextMenu(e);
          }}
          className="text-[#b3b3b3] hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-2 -mr-1"
          title="More options"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
    </div>
  );
});
