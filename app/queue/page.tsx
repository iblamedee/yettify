"use client";

import React, { useState, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { TrackTable } from "@/components/track/TrackTable";
import { Trash2, Music } from "lucide-react";
import { Track } from "@/types";

export default function QueuePage() {
  const { currentTrack, userQueue, contextQueue, clearUserQueue, removeFromQueue } = usePlayer();
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [history, setHistory] = useState<Track[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (tab === "history") {
      setIsLoadingHistory(true);
      fetch("/api/me/history")
        .then((res) => res.json())
        .then((data) => {
          setHistory(data.history?.map((h: any) => h.track) || []);
        })
        .catch(() => {})
        .finally(() => setIsLoadingHistory(false));
    }
  }, [tab]);

  return (
    <div className="max-w-4xl space-y-6 pb-16">
      {/* Tab Header */}
      <div className="flex items-center gap-6 border-b border-[#282828] pb-3">
        <button
          onClick={() => setTab("queue")}
          className={`text-xl font-bold transition-colors ${
            tab === "queue" ? "text-white" : "text-[#b3b3b3] hover:text-white"
          }`}
        >
          Queue
        </button>
        <button
          onClick={() => setTab("history")}
          className={`text-xl font-bold transition-colors ${
            tab === "history" ? "text-white" : "text-[#b3b3b3] hover:text-white"
          }`}
        >
          Recently played
        </button>
      </div>

      {tab === "queue" ? (
        <div className="space-y-8">
          {/* Now Playing */}
          {currentTrack && (
            <div>
              <h3 className="text-xs uppercase font-bold text-[#b3b3b3] tracking-wider mb-3">
                Now playing
              </h3>
              <TrackTable tracks={[currentTrack]} showAlbum={true} />
            </div>
          )}

          {/* User Custom Queue */}
          {userQueue.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase font-bold text-[#b3b3b3] tracking-wider">
                  Next in queue
                </h3>
                <button
                  onClick={clearUserQueue}
                  className="text-xs font-bold text-[#b3b3b3] hover:text-white flex items-center gap-1 hover:underline"
                >
                  <Trash2 size={14} />
                  <span>Clear queue</span>
                </button>
              </div>
              <TrackTable tracks={userQueue} showAlbum={true} />
            </div>
          )}

          {/* Context Queue */}
          {contextQueue.length > 0 && (
            <div>
              <h3 className="text-xs uppercase font-bold text-[#b3b3b3] tracking-wider mb-3">
                Next up
              </h3>
              <TrackTable tracks={contextQueue} showAlbum={true} />
            </div>
          )}

          {!currentTrack && userQueue.length === 0 && contextQueue.length === 0 && (
            <div className="py-24 text-center text-[#b3b3b3] space-y-2">
              <Music size={40} className="mx-auto opacity-30" />
              <p className="text-lg font-bold text-white">Your queue is empty</p>
              <p className="text-sm">Find tracks or albums and add them to your queue.</p>
            </div>
          )}
        </div>
      ) : (
        /* History Tab */
        <div>
          {isLoadingHistory ? (
            <div className="py-20 text-center text-[#b3b3b3]">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="py-24 text-center text-[#b3b3b3]">
              <p className="text-lg font-bold text-white">No listening history yet</p>
              <p className="text-sm mt-1">Play some tracks to start building your history.</p>
            </div>
          ) : (
            <TrackTable tracks={history} showAlbum={true} />
          )}
        </div>
      )}
    </div>
  );
}
