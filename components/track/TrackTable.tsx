"use client";

import React from "react";
import { Track } from "@/types";
import { TrackRow } from "./TrackRow";
import { Clock } from "lucide-react";

interface TrackTableProps {
  tracks: Track[];
  showAlbum?: boolean;
  showDateAdded?: boolean;
  playlistId?: string;
  onRemoveTrack?: (trackId: string) => void;
}

export function TrackTable({
  tracks,
  showAlbum = true,
  showDateAdded = false,
  playlistId,
  onRemoveTrack,
}: TrackTableProps) {
  if (tracks.length === 0) {
    return (
      <div className="py-12 text-center text-[#b3b3b3]">
        <p className="text-sm font-semibold">No tracks found</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Table Header Row (Hidden on mobile) */}
      <div
        className="hidden md:grid items-center py-2 px-4 border-b border-[#282828] text-xs font-bold uppercase tracking-wider text-[#b3b3b3] mb-2 select-none"
        style={{
          gridTemplateColumns:
            showAlbum && showDateAdded
              ? "40px 4fr 3fr 2fr 40px 60px 40px"
              : showAlbum
              ? "40px 6fr 4fr 40px 60px 40px"
              : "40px 8fr 40px 60px 40px",
        }}
      >
        <div className="text-center">#</div>
        <div>Title</div>
        {showAlbum && <div className="hidden md:block">Album</div>}
        {showDateAdded && <div className="hidden lg:block">Date added</div>}
        <div className="text-center" />
        <div className="flex justify-end pr-2">
          <Clock size={16} />
        </div>
        <div className="text-center" />
      </div>

      {/* Track Rows */}
      <div className="space-y-0.5">
        {tracks.map((track, index) => (
          <TrackRow
            key={`${track.id}-${index}`}
            track={track}
            index={index}
            contextList={tracks}
            showAlbum={showAlbum}
            showDateAdded={showDateAdded}
            playlistId={playlistId}
            onRemove={onRemoveTrack ? () => onRemoveTrack(track.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
