"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { usePlayer, usePlayerProgress } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { Mic2, Music, Heart } from "lucide-react";
import Link from "next/link";

interface LyricLine {
  time: number;
  text: string;
}

function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split("\n");
  const result: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;

  for (const line of lines) {
    const match = regex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = match[3] ? parseInt(match[3], 10) / (match[3].length === 3 ? 1000 : 100) : 0;
      const time = minutes * 60 + seconds + millis;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    } else if (line.trim()) {
      result.push({ time: -1, text: line.trim() });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export default function LyricsPage() {
  const { currentTrack } = usePlayer();
  const { currentTime, seekTo } = usePlayerProgress();
  const { isTrackLiked, toggleLikeTrack } = useLibrary();
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return [];
    return parseLrc(currentTrack.lyrics);
  }, [currentTrack]);

  // Find active line index
  const activeIndex = useMemo(() => {
    if (parsedLyrics.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time <= currentTime) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [parsedLyrics, currentTime]);

  // Auto-scroll active line into view smoothly
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  if (!currentTrack) {
    return (
      <div className="py-24 text-center text-[#b3b3b3] space-y-3">
        <Mic2 size={48} className="mx-auto opacity-30" />
        <h2 className="text-xl font-bold text-white">No track playing</h2>
        <p className="text-sm">Play a song with lyrics to view them here.</p>
      </div>
    );
  }

  if (parsedLyrics.length === 0) {
    return (
      <div className="py-24 text-center text-[#b3b3b3] space-y-3 max-w-md mx-auto">
        <Music size={48} className="mx-auto opacity-30" />
        <h2 className="text-xl font-bold text-white">
          Looks like we don&apos;t have the lyrics for this song
        </h2>
        <p className="text-sm">
          Try playing &quot;BIRDS OF A FEATHER&quot; or &quot;Espresso&quot; to see real-time lyrics synchronization.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 pb-24">
      {/* Track Meta header */}
      <div className="flex items-center justify-between gap-4 mb-8 pb-4 border-b border-[#282828]">
        <div className="flex items-center gap-4">
          <img
            src={currentTrack.album?.coverUrl || "/placeholder.png"}
            alt={currentTrack.title}
            loading="lazy"
            decoding="async"
            className="w-16 h-16 rounded-md object-cover shadow-lg"
          />
          <div>
            <h2 className="text-xl font-bold text-white">{currentTrack.title}</h2>
            <Link
              href={`/artist/${currentTrack.artistId}`}
              className="text-sm text-[#b3b3b3] hover:underline hover:text-white"
            >
              {currentTrack.artist?.name}
            </Link>
          </div>
        </div>

        <button
          onClick={() => toggleLikeTrack(currentTrack)}
          className="text-[#b3b3b3] hover:text-white transition-all p-2 hover:scale-110 active:scale-90"
          title={isTrackLiked(currentTrack.id) ? "Remove from Liked Songs" : "Save to Liked Songs"}
          aria-label={isTrackLiked(currentTrack.id) ? "Remove from Liked Songs" : "Save to Liked Songs"}
        >
          <Heart
            size={22}
            className={isTrackLiked(currentTrack.id) ? "fill-spotify-green text-spotify-green" : ""}
          />
        </button>
      </div>

      {/* Synchronized Lyrics Container */}
      <div className="space-y-6">
        {parsedLyrics.map((line, idx) => {
          const isActive = idx === activeIndex;
          const isPassed = idx < activeIndex;

          return (
            <p
              key={idx}
              ref={isActive ? activeLineRef : null}
              onClick={() => {
                if (line.time >= 0) seekTo(line.time);
              }}
              className={`text-2xl md:text-3xl font-bold transition-all duration-300 cursor-pointer select-none leading-relaxed ${
                isActive
                  ? "text-white scale-102 font-black opacity-100"
                  : isPassed
                  ? "text-[#b3b3b3]/60 hover:text-white"
                  : "text-[#b3b3b3]/30 hover:text-white"
              }`}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
