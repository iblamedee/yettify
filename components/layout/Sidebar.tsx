"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/navigation";
import { usePathname, useRouter } from "next/navigation";
import { useUI } from "@/contexts/UIContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  Search,
  Library,
  Plus,
  Heart,
  Music,
  User as UserIcon,
  Disc,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { PlaylistCover } from "@/components/playlist/PlaylistCover";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarWidth, setSidebarWidth, showContextMenu } = useUI();
  const { userPlaylists, likedTrackIds, savedAlbums, followedArtists, createPlaylist, deletePlaylist } = useLibrary();
  const { isAuthenticated } = useAuth();

  const [activeFilter, setActiveFilter] = useState<"all" | "playlists" | "artists" | "albums">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isResizing, setIsResizing] = useState(false);

  // Drag-to-resize logic
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      setSidebarWidth(e.clientX);
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Handle right click on playlist
  const handlePlaylistContextMenu = (e: React.MouseEvent, pl: any) => {
    showContextMenu(
      e,
      [
        {
          label: "Edit details",
          onClick: () => {
            // will trigger edit modal
          },
        },
        {
          label: "Delete playlist",
          destructive: true,
          onClick: () => deletePlaylist(pl.id),
        },
      ],
      pl
    );
  };

  const isHomeActive = pathname === "/";
  const isSearchActive = pathname.startsWith("/search");
  const isLikedActive = pathname === "/collection/tracks";

  const filteredPlaylists = userPlaylists.filter((pl) =>
    pl.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAlbums = savedAlbums.filter((alb) =>
    alb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (alb.artist?.name && alb.artist.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredArtists = followedArtists.filter((art) =>
    art.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showLikedSongs = (activeFilter === "all" || activeFilter === "playlists") &&
    "liked songs".includes(searchQuery.toLowerCase());
  const showPlaylists = activeFilter === "all" || activeFilter === "playlists";
  const showAlbums = activeFilter === "all" || activeFilter === "albums";
  const showArtists = activeFilter === "all" || activeFilter === "artists";

  return (
    <aside
      className="hidden md:flex flex-col gap-2 h-full select-none relative shrink-0 p-2 pt-0 pb-0"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* 1. Top Navigation Box */}
      <div className="bg-[#121212] rounded-lg p-4 flex flex-col gap-5">
        {/* Spotify Logo */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 bg-spotify-green rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-black">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.502 9.722 1.113.294.18.386.563.207.857zm1.225-2.723c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.517-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.48.707.257 1.071zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.493.15-1.016-.129-1.166-.621-.149-.494.13-1.016.622-1.166 3.532-1.072 9.404-.865 13.115 1.338.445.264.59.838.327 1.282-.264.443-.838.59-1.28.323z" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">Spotify</span>
        </button>

        {/* Primary Links */}
        <nav className="flex flex-col gap-4 text-sm font-bold">
          <button
            onClick={() => router.push("/")}
            className={`flex items-center gap-4 transition-colors ${
              isHomeActive ? "text-white" : "text-[#b3b3b3] hover:text-white"
            }`}
          >
            <Home size={24} className={isHomeActive ? "text-white" : "text-[#b3b3b3]"} />
            <span>Home</span>
          </button>

          <button
            onClick={() => router.push("/search")}
            className={`flex items-center gap-4 transition-colors ${
              isSearchActive ? "text-white" : "text-[#b3b3b3] hover:text-white"
            }`}
          >
            <Search size={24} className={isSearchActive ? "text-white" : "text-[#b3b3b3]"} />
            <span>Search</span>
          </button>
        </nav>
      </div>

      {/* 2. Your Library Box */}
      <div className="bg-[#121212] rounded-lg flex-1 flex flex-col overflow-hidden">
        {/* Library Header */}
        <div className="p-4 pb-2 flex items-center justify-between">
          <button
            onClick={() => router.push("/collection/playlists")}
            className="flex items-center gap-3 text-[#b3b3b3] hover:text-white transition-colors group"
            title="Collapse or view library"
          >
            <Library size={24} className="group-hover:text-white" />
            <span className="font-bold text-sm">Your Library</span>
          </button>

          <button
            onClick={() => createPlaylist()}
            className="text-[#b3b3b3] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
            title="Create playlist or folder (Ctrl + N)"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveFilter(activeFilter === "playlists" ? "all" : "playlists")}
            className={`px-3 py-1 rounded-pill text-xs font-semibold shrink-0 transition-colors ${
              activeFilter === "playlists"
                ? "bg-white text-black"
                : "bg-[#242424] text-white hover:bg-[#2a2a2a]"
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === "artists" ? "all" : "artists")}
            className={`px-3 py-1 rounded-pill text-xs font-semibold shrink-0 transition-colors ${
              activeFilter === "artists"
                ? "bg-white text-black"
                : "bg-[#242424] text-white hover:bg-[#2a2a2a]"
            }`}
          >
            Artists
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === "albums" ? "all" : "albums")}
            className={`px-3 py-1 rounded-pill text-xs font-semibold shrink-0 transition-colors ${
              activeFilter === "albums"
                ? "bg-white text-black"
                : "bg-[#242424] text-white hover:bg-[#2a2a2a]"
            }`}
          >
            Albums
          </button>
        </div>

        {/* Library Search Bar */}
        <div className="px-4 py-1.5 flex items-center justify-between">
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b3b3b3]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in Your Library"
              className="w-full bg-[#242424] text-xs text-white pl-8 pr-6 py-1.5 rounded-md placeholder-[#b3b3b3] focus:outline-none focus:ring-1 focus:ring-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Library Content */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {/* Pinned: Liked Songs */}
          {showLikedSongs && (
            <button
              onClick={() => router.push("/collection/tracks")}
              data-testid="sidebar-liked-songs-link"
              className={`w-full p-2 rounded-md flex items-center gap-3 hover:bg-[#1a1a1a] transition-colors group ${
                isLikedActive ? "bg-[#232323]" : ""
              }`}
            >
              <div className="w-12 h-12 rounded bg-gradient-purple flex items-center justify-center shrink-0 shadow-md">
                <Heart size={20} className="fill-white text-white" />
              </div>
              <div className="flex flex-col text-left overflow-hidden">
                <span className={`text-sm font-semibold truncate ${isLikedActive ? "text-spotify-green" : "text-white"}`}>
                  Liked Songs
                </span>
                <span className="text-xs text-[#b3b3b3] truncate flex items-center gap-1">
                  📌 Playlist • {likedTrackIds.size} songs
                </span>
              </div>
            </button>
          )}

          {/* User Playlists */}
          {showPlaylists &&
            filteredPlaylists.map((pl) => {
              const isPlActive = pathname === `/playlist/${pl.id}`;
              return (
                <button
                  key={pl.id}
                  onClick={() => router.push(`/playlist/${pl.id}`)}
                  onContextMenu={(e) => handlePlaylistContextMenu(e, pl)}
                  className={`w-full p-2 rounded-md flex items-center gap-3 hover:bg-[#1a1a1a] transition-colors group text-left ${
                    isPlActive ? "bg-[#232323]" : ""
                  }`}
                >
                  <div className="w-12 h-12 rounded bg-[#282828] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                    <PlaylistCover
                      coverUrl={pl.coverUrl}
                      tracks={pl.tracks}
                      title={pl.title}
                      iconSize={20}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-sm font-semibold truncate ${isPlActive ? "text-spotify-green" : "text-white"}`}>
                      {pl.title}
                    </span>
                    <span className="text-xs text-[#b3b3b3] truncate">
                      Playlist • {pl.owner?.displayName || "Spotify"}
                    </span>
                  </div>
                </button>
              );
            })}

          {/* Saved Albums */}
          {showAlbums &&
            filteredAlbums.map((alb) => {
              const isAlbActive = pathname === `/album/${alb.id}`;
              return (
                <button
                  key={alb.id}
                  onClick={() => router.push(`/album/${alb.id}`)}
                  data-testid={`sidebar-album-${alb.id}`}
                  className={`w-full p-2 rounded-md flex items-center gap-3 hover:bg-[#1a1a1a] transition-colors group text-left ${
                    isAlbActive ? "bg-[#232323]" : ""
                  }`}
                >
                  <div className="w-12 h-12 rounded bg-[#282828] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                    {alb.coverUrl ? (
                      <img src={alb.coverUrl} alt={alb.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <Disc size={20} className="text-[#b3b3b3]" />
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-sm font-semibold truncate ${isAlbActive ? "text-spotify-green" : "text-white"}`}>
                      {alb.title}
                    </span>
                    <span className="text-xs text-[#b3b3b3] truncate">
                      Album • {alb.artist?.name || "Artist"}
                    </span>
                  </div>
                </button>
              );
            })}

          {/* Followed Artists */}
          {showArtists &&
            filteredArtists.map((art) => {
              const isArtActive = pathname === `/artist/${art.id}`;
              return (
                <button
                  key={art.id}
                  onClick={() => router.push(`/artist/${art.id}`)}
                  data-testid={`sidebar-artist-${art.id}`}
                  className={`w-full p-2 rounded-md flex items-center gap-3 hover:bg-[#1a1a1a] transition-colors group text-left ${
                    isArtActive ? "bg-[#232323]" : ""
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#282828] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                    {art.avatarUrl ? (
                      <img src={art.avatarUrl} alt={art.name} loading="lazy" decoding="async" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <UserIcon size={20} className="text-[#b3b3b3]" />
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-sm font-semibold truncate ${isArtActive ? "text-spotify-green" : "text-white"}`}>
                      {art.name}
                    </span>
                    <span className="text-xs text-[#b3b3b3] truncate">
                      Artist
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* 3. Draggable Right Resizer Border Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-white/30 transition-colors z-40 ${
          isResizing ? "bg-white/50" : ""
        }`}
        title="Drag to resize main navigation"
      />
    </aside>
  );
}
