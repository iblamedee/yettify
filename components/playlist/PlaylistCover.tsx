"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Music } from "lucide-react";

interface PlaylistCoverProps {
  coverUrl?: string | null;
  tracks?: any[] | null;
  trackCovers?: string[] | null;
  title?: string;
  className?: string;
  iconSize?: number;
}

export function PlaylistCover({
  coverUrl,
  tracks,
  trackCovers,
  title = "Playlist",
  className = "",
  iconSize = 36,
}: PlaylistCoverProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [coverUrl]);

  // Extract up to 4 unique album covers from track list
  const distinctCovers = useMemo(() => {
    const list: string[] = [];

    if (trackCovers && trackCovers.length > 0) {
      for (const c of trackCovers) {
        if (c && typeof c === "string" && !list.includes(c)) {
          list.push(c);
          if (list.length === 4) break;
        }
      }
    } else if (tracks && tracks.length > 0) {
      for (const item of tracks) {
        const cover =
          item?.track?.album?.coverUrl ||
          item?.album?.coverUrl ||
          item?.coverUrl ||
          (typeof item === "string" ? item : null);

        if (cover && typeof cover === "string" && !list.includes(cover)) {
          list.push(cover);
          if (list.length === 4) break;
        }
      }
    }

    return list;
  }, [tracks, trackCovers]);

  // 1. Explicit Custom Cover provided
  if (coverUrl && !imgError) {
    return (
      <div className={`w-full h-full overflow-hidden ${className}`}>
        <img
          src={coverUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // 2. Dynamic 2x2 Collage Grid (4 or more unique track album covers)
  if (distinctCovers.length >= 4) {
    return (
      <div className={`grid grid-cols-2 grid-rows-2 w-full h-full overflow-hidden ${className}`}>
        {distinctCovers.slice(0, 4).map((c, i) => (
          <img
            key={i}
            src={c}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop";
            }}
          />
        ))}
      </div>
    );
  }

  // 3. Single Cover (1 to 3 tracks)
  if (distinctCovers.length >= 1) {
    return (
      <div className={`w-full h-full overflow-hidden ${className}`}>
        <img
          src={distinctCovers[0]}
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop";
          }}
        />
      </div>
    );
  }

  // 4. Default Empty Playlist Placeholder (Authentic Spotify Gradient with Music Note)
  return (
    <div
      className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#121212] text-[#7a7a7a] shadow-inner ${className}`}
      title={title}
    >
      <Music size={iconSize} className="stroke-[1.5]" />
    </div>
  );
}
