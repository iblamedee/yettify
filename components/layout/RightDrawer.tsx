"use client";

import React from "react";
import { useUI } from "@/contexts/UIContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { X, Play, Trash2, Music, Heart } from "lucide-react";
import Link from "next/link";

export function RightDrawer() {
  const { isRightDrawerOpen, closeRightDrawer, rightDrawerView } = useUI();
  const { isTrackLiked, toggleLikeTrack } = useLibrary();
  const {
    currentTrack,
    userQueue,
    contextQueue,
    removeFromQueue,
    clearUserQueue,
    playTrack,
  } = usePlayer();

  if (!isRightDrawerOpen) return null;

  return (
    <aside className="w-80 md:w-96 bg-[#121212] rounded-lg p-4 flex flex-col h-full border-l border-[#282828] shrink-0 select-none overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#282828]">
        <h2 className="text-base font-bold text-white">
          {rightDrawerView === "queue" ? "Queue" : "Friend Activity"}
        </h2>
        <button
          onClick={closeRightDrawer}
          className="text-[#b3b3b3] hover:text-white p-1 rounded-full hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {rightDrawerView === "queue" ? (
        <div className="flex-1 overflow-y-auto space-y-6 pt-3 pr-1">
          {/* Now Playing */}
          {currentTrack && (
            <div>
              <h3 className="text-xs uppercase font-bold text-[#b3b3b3] mb-2 tracking-wider">
                Now playing
              </h3>
              <div className="p-2.5 rounded-md bg-[#242424] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={currentTrack.album?.coverUrl || "/placeholder.png"}
                    alt={currentTrack.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold text-spotify-green truncate">
                      {currentTrack.title}
                    </span>
                    <span className="text-xs text-[#b3b3b3] truncate">
                      {currentTrack.artist?.name}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => toggleLikeTrack(currentTrack)}
                  className="text-[#b3b3b3] hover:text-white transition-all p-1 hover:scale-110 active:scale-90 shrink-0"
                  title={isTrackLiked(currentTrack.id) ? "Remove from Liked Songs" : "Save to Liked Songs"}
                  aria-label={isTrackLiked(currentTrack.id) ? "Remove from Liked Songs" : "Save to Liked Songs"}
                >
                  <Heart
                    size={18}
                    className={isTrackLiked(currentTrack.id) ? "fill-spotify-green text-spotify-green" : ""}
                  />
                </button>
              </div>
            </div>
          )}

          {/* User Custom Queue */}
          {userQueue.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase font-bold text-[#b3b3b3] tracking-wider">
                  Next in queue
                </h3>
                <button
                  onClick={clearUserQueue}
                  className="text-xs font-bold text-[#b3b3b3] hover:text-white hover:underline flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  <span>Clear queue</span>
                </button>
              </div>

              <div className="space-y-1">
                {userQueue.map((track, idx) => (
                  <div
                    key={`${track.id}-${idx}`}
                    className="p-2 rounded-md hover:bg-[#1f1f1f] flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={track.album?.coverUrl || "/placeholder.png"}
                        alt={track.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium text-white truncate">
                          {track.title}
                        </span>
                        <span className="text-xs text-[#b3b3b3] truncate">
                          {track.artist?.name}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromQueue(idx)}
                      className="text-[#b3b3b3] hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from queue"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next From Context (Album / Playlist) */}
          {contextQueue.length > 0 && (
            <div>
              <h3 className="text-xs uppercase font-bold text-[#b3b3b3] mb-2 tracking-wider">
                Next up
              </h3>
              <div className="space-y-1">
                {contextQueue.slice(0, 15).map((track, idx) => (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => playTrack(track, contextQueue, idx)}
                    className="p-2 rounded-md hover:bg-[#1f1f1f] flex items-center gap-3 group cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded bg-[#282828] overflow-hidden shrink-0 relative flex items-center justify-center">
                      <img
                        src={track.album?.coverUrl || "/placeholder.png"}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
                      />
                      <Play
                        size={16}
                        className="absolute text-white fill-white opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-white group-hover:text-spotify-green truncate transition-colors">
                        {track.title}
                      </span>
                      <span className="text-xs text-[#b3b3b3] truncate">
                        {track.artist?.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {userQueue.length === 0 && contextQueue.length === 0 && !currentTrack && (
            <div className="text-center py-12 text-[#b3b3b3]">
              <Music size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Your queue is empty</p>
              <p className="text-xs mt-1">Play a track or album to start listening</p>
            </div>
          )}
        </div>
      ) : (
        /* Friend Activity Panel */
        <div className="flex-1 pt-4 text-center text-[#b3b3b3] space-y-4">
          <p className="text-sm font-semibold text-white">Friend Activity</p>
          <p className="text-xs leading-relaxed px-4">
            Connect with friends on Spotify to see what they are currently playing in real-time.
          </p>
          <div className="p-3 bg-[#181818] rounded-md text-left text-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                J
              </div>
              <div className="overflow-hidden">
                <p className="font-semibold text-white truncate">Jordan Smith</p>
                <p className="text-[#b3b3b3] truncate">BIRDS OF A FEATHER • Billie Eilish</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
