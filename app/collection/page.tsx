"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLibrary } from "@/contexts/LibraryContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUI } from "@/contexts/UIContext";
import { Heart, Plus, Disc, User as UserIcon, ListMusic } from "lucide-react";
import { PlaylistCover } from "@/components/playlist/PlaylistCover";

export default function MobileLibraryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { userPlaylists, likedTrackIds, savedAlbums, followedArtists, createPlaylist } = useLibrary();
  const { openModal } = useUI();
  const [filter, setFilter] = useState<"all" | "playlists" | "artists" | "albums">("all");

  const handleCreatePlaylist = async () => {
    if (!user) {
      openModal("auth");
      return;
    }
    const newPl = await createPlaylist("My Playlist #" + (userPlaylists.length + 1));
    if (newPl) {
      router.push(`/playlist/${newPl.id}`);
    }
  };

  const showPlaylists = filter === "all" || filter === "playlists";
  const showArtists = filter === "all" || filter === "artists";
  const showAlbums = filter === "all" || filter === "albums";

  return (
    <div className="pb-24 space-y-4 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-black text-white">Your Library</h1>
        <button
          onClick={handleCreatePlaylist}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          title="Create playlist"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {(["all", "playlists", "artists", "albums"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-white text-black"
                : "bg-[#282828] text-white hover:bg-[#333]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Library Items List */}
      <div className="space-y-1">
        {/* Liked Songs Tile */}
        {showPlaylists && (
          <Link
            href="/collection/tracks"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <div className="w-14 h-14 rounded-md bg-gradient-purple flex items-center justify-center shrink-0 shadow-md">
              <Heart size={24} className="fill-white text-white" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-sm text-white truncate">Liked Songs</span>
              <span className="text-xs text-[#b3b3b3]">
                Playlist • {likedTrackIds.size} {likedTrackIds.size === 1 ? "song" : "songs"}
              </span>
            </div>
          </Link>
        )}

        {/* User Playlists */}
        {showPlaylists &&
          userPlaylists.map((pl) => (
            <Link
              key={pl.id}
              href={`/playlist/${pl.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="w-14 h-14 rounded-md bg-[#282828] overflow-hidden shrink-0 shadow-md">
                <PlaylistCover
                  coverUrl={pl.coverUrl}
                  title={pl.title}
                  iconSize={24}
                  className="w-full h-full"
                />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-sm text-white truncate">{pl.title}</span>
                <span className="text-xs text-[#b3b3b3] truncate">
                  Playlist • {pl.owner?.displayName || "You"}
                </span>
              </div>
            </Link>
          ))}

        {/* Saved Albums */}
        {showAlbums &&
          savedAlbums.map((alb) => (
            <Link
              key={alb.id}
              href={`/album/${alb.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="w-14 h-14 rounded-md bg-[#282828] overflow-hidden shrink-0 shadow-md">
                {alb.coverUrl ? (
                  <img
                    src={alb.coverUrl}
                    alt={alb.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#777]">
                    <Disc size={24} />
                  </div>
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-sm text-white truncate">{alb.title}</span>
                <span className="text-xs text-[#b3b3b3] truncate">
                  Album • {alb.artist?.name || "Various Artists"}
                </span>
              </div>
            </Link>
          ))}

        {/* Followed Artists */}
        {showArtists &&
          followedArtists.map((art) => (
            <Link
              key={art.id}
              href={`/artist/${art.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-[#282828] overflow-hidden shrink-0 shadow-md">
                {art.avatarUrl ? (
                  <img
                    src={art.avatarUrl}
                    alt={art.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#777]">
                    <UserIcon size={24} />
                  </div>
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-sm text-white truncate">{art.name}</span>
                <span className="text-xs text-[#b3b3b3]">Artist</span>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
