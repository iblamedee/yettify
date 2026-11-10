"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MediaCard } from "@/components/media/MediaCard";
import { TrackTable } from "@/components/track/TrackTable";
import { Genre, Track, Artist, Album, Playlist } from "@/types";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { Play, Pause, Heart, Youtube, Disc, User as UserIcon } from "lucide-react";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const [filter, setFilter] = useState<"all" | "tracks" | "artists" | "albums" | "playlists" | "youtube" | "spotify">("all");

  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();
  const { isTrackLiked, toggleLikeTrack } = useLibrary();

  const [genres, setGenres] = useState<Genre[]>([]);
  const [searchResults, setSearchResults] = useState<{
    topResult: any;
    tracks: Track[];
    artists: Artist[];
    albums: Album[];
    playlists: Playlist[];
  }>({
    topResult: null,
    tracks: [],
    artists: [],
    albums: [],
    playlists: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const searchCacheRef = useRef<Map<string, any>>(new Map());
  const requestIdRef = useRef(0);
  const [topImgError, setTopImgError] = useState(false);

  // Fetch genres for default browse view
  useEffect(() => {
    fetch("/api/genres")
      .then((res) => res.json())
      .then((data) => setGenres(data.genres || []))
      .catch(() => {});
  }, []);

  // Fetch search results when query or filter changes with instant client-side cache and AbortController
  useEffect(() => {
    if (!query.trim()) {
      setIsLoading(false);
      return;
    }

    const cacheKey = `${filter}:::${query.trim().toLowerCase()}`;
    if (searchCacheRef.current.has(cacheKey)) {
      setSearchResults(searchCacheRef.current.get(cacheKey));
      setIsLoading(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const controller = new AbortController();

    setIsLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query.trim())}&type=${filter}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || currentRequestId !== requestIdRef.current) return;
        const resultPayload = {
          topResult: data.topResult,
          tracks: data.tracks || [],
          artists: data.artists || [],
          albums: data.albums || [],
          playlists: data.playlists || [],
        };
        searchCacheRef.current.set(cacheKey, resultPayload);
        setSearchResults(resultPayload);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
      })
      .finally(() => {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [query, filter]);

  // Reset top image error state on result change
  useEffect(() => {
    setTopImgError(false);
  }, [searchResults.topResult?.id]);

  // Browse All View when no query
  if (!query) {
    return (
      <div className="space-y-6 pb-16">
        <h2 className="text-2xl font-bold text-white">Browse all</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {genres.map((g) => (
            <div
              key={g.id}
              onClick={() => router.push(`/search?q=${encodeURIComponent(g.name)}`)}
              className="aspect-square rounded-lg p-4 font-bold text-lg md:text-xl text-white relative overflow-hidden cursor-pointer hover:scale-102 transition-transform shadow-md"
              style={{ backgroundColor: g.colorHex }}
            >
              <span className="relative z-10 leading-tight block">{g.name}</span>
              {g.imageUrl && (
                <img
                  src={g.imageUrl}
                  alt={g.name}
                  className="w-24 h-24 object-cover rounded-md absolute -bottom-2 -right-3 rotate-[25deg] shadow-lg pointer-events-none"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Filter pills
  const filterPills = [
    { id: "all", label: "All" },
    { id: "tracks", label: "Songs" },
    { id: "artists", label: "Artists" },
    { id: "albums", label: "Albums" },
    { id: "playlists", label: "Playlists" },
    { id: "youtube", label: "YouTube" },
    { id: "spotify", label: "Spotify" },
  ];

  const tr = searchResults.topResult;
  const isTopPlaying = tr?.id === currentTrack?.id && isPlaying;
  const topCover =
    tr?.avatarUrl || tr?.coverUrl || tr?.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop";

  const handleTopPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tr) return;

    if (tr.resultType === "track") {
      if (currentTrack?.id === tr.id) {
        togglePlayPause();
      } else {
        playTrack(tr, searchResults.tracks);
      }
    } else if (tr.resultType === "artist") {
      // Prioritize tracks strictly performed by this artist
      const artistName = (tr.name || "").toLowerCase().trim();
      const artistTracks = searchResults.tracks.filter((t) => {
        const tArtist = (t.artist?.name || "").toLowerCase().trim();
        return tArtist.includes(artistName) || artistName.includes(tArtist);
      });
      if (artistTracks.length > 0) {
        playTrack(artistTracks[0], artistTracks);
      } else if (tr.id) {
        fetch(`/api/artists/${tr.id}/top-tracks`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.tracks && data.tracks.length > 0) {
              playTrack(data.tracks[0], data.tracks);
            } else if (searchResults.tracks.length > 0) {
              playTrack(searchResults.tracks[0], searchResults.tracks);
            }
          })
          .catch(() => {
            if (searchResults.tracks.length > 0) {
              playTrack(searchResults.tracks[0], searchResults.tracks);
            }
          });
      }
    } else if (searchResults.tracks.length > 0) {
      playTrack(searchResults.tracks[0], searchResults.tracks);
    }
  };

  const handleTopClick = () => {
    if (!tr) return;
    if (tr.resultType === "track") {
      if (currentTrack?.id === tr.id) {
        togglePlayPause();
      } else {
        playTrack(tr, searchResults.tracks);
      }
    } else if (tr.resultType === "artist") {
      router.push(`/artist/${tr.id}`);
    } else if (tr.resultType === "album") {
      router.push(`/album/${tr.id}`);
    } else if (tr.resultType === "playlist") {
      router.push(`/playlist/${tr.id}`);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filterPills.map((pill) => (
          <button
            key={pill.id}
            onClick={() => setFilter(pill.id as any)}
            className={`px-4 py-1.5 rounded-pill text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              filter === pill.id
                ? "bg-white text-black"
                : "bg-[#242424] text-white hover:bg-[#2a2a2a]"
            }`}
          >
            {pill.id === "youtube" && <Youtube size={14} className={filter === pill.id ? "text-red-600" : "text-[#b3b3b3]"} />}
            {pill.id === "spotify" && <Disc size={14} className={filter === pill.id ? "text-spotify-green" : "text-[#b3b3b3]"} />}
            {pill.label}
          </button>
        ))}
      </div>

      {isLoading && searchResults.tracks.length === 0 ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 h-[230px] rounded-lg bg-[#181818]" />
            <div className="lg:col-span-3 space-y-2">
              <div className="h-10 rounded bg-[#181818]" />
              <div className="h-10 rounded bg-[#181818]" />
              <div className="h-10 rounded bg-[#181818]" />
              <div className="h-10 rounded bg-[#181818]" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Result & Top Songs Section */}
          {filter === "all" && tr && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Top Result Card */}
              <div className="lg:col-span-2">
                <h3 className="text-xl font-bold text-white mb-3">Top result</h3>
                <div
                  onClick={handleTopClick}
                  className="p-5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-colors cursor-pointer group relative flex flex-col justify-between h-[230px]"
                >
                  <div className="flex items-center gap-4">
                    {topImgError ? (
                      <div
                        className={`w-24 h-24 flex items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#141414] text-[#777] shadow-lg ${
                          tr.resultType === "artist" ? "rounded-full" : "rounded-md"
                        }`}
                      >
                        {tr.resultType === "artist" ? <UserIcon size={36} /> : <Disc size={36} />}
                      </div>
                    ) : (
                      <img
                        src={topCover}
                        alt={tr.name || tr.title}
                        onError={() => setTopImgError(true)}
                        className={`w-24 h-24 object-cover shadow-lg ${
                          tr.resultType === "artist" ? "rounded-full" : "rounded-md"
                        }`}
                      />
                    )}
                  </div>

                  <div>
                    <h4 className="text-2xl font-bold text-white truncate mb-1">
                      {tr.name || tr.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-[#b3b3b3]">
                      <span className="uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/40">
                        {tr.resultType}
                      </span>
                      {tr.resultType === "track" && tr.artist?.name && (
                        <span>• {tr.artist.name}</span>
                      )}
                      {tr.source && (
                        <span className="uppercase text-[10px] font-semibold tracking-wider text-spotify-green">
                          {tr.source}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons Overlay */}
                  <div className="absolute right-5 bottom-5 flex items-center gap-3">
                    {tr.resultType === "track" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeTrack(tr);
                        }}
                        aria-label={isTrackLiked(tr.id) ? "Remove from Liked Songs" : "Save to Liked Songs"}
                        title={isTrackLiked(tr.id) ? "Remove from Liked Songs" : "Save to Liked Songs"}
                        data-testid="top-result-like-button"
                        className={`p-2 rounded-full transition-all hover:scale-110 active:scale-90 ${
                          isTrackLiked(tr.id)
                            ? "text-spotify-green opacity-100"
                            : "text-[#b3b3b3] opacity-0 group-hover:opacity-100 hover:text-white"
                        }`}
                      >
                        <Heart size={22} className={isTrackLiked(tr.id) ? "fill-spotify-green" : ""} />
                      </button>
                    )}

                    <button
                      onClick={handleTopPlay}
                      aria-label={isTopPlaying ? "Pause" : "Play"}
                      className="w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 transition-all shadow-spotify-play"
                    >
                      {isTopPlaying ? (
                        <Pause size={22} className="fill-black text-black" />
                      ) : (
                        <Play size={22} className="fill-black text-black ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Songs List (Right of Top Result) */}
              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-white">Songs</h3>
                  {searchResults.tracks.length > 5 && (
                    <button
                      onClick={() => setFilter("tracks")}
                      className="text-xs font-bold text-[#b3b3b3] hover:text-white uppercase tracking-wider transition-colors"
                    >
                      See all ({searchResults.tracks.length})
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {searchResults.tracks.slice(0, 5).map((track, idx) => {
                    const isTrackCurrent = currentTrack?.id === track.id;
                    const isTrackPlaying = isTrackCurrent && isPlaying;
                    const liked = isTrackLiked(track.id);

                    return (
                      <div
                        key={track.id}
                        data-testid="search-track-row"
                        onClick={() => {
                          if (isTrackCurrent) {
                            togglePlayPause();
                          } else {
                            playTrack(track, searchResults.tracks, idx);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-md hover:bg-[#282828] group cursor-pointer transition-colors ${
                          isTrackCurrent ? "bg-white/5" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-3">
                          {/* Thumbnail with Play/Pause button */}
                          <div className="relative w-10 h-10 rounded overflow-hidden shrink-0 bg-[#282828]">
                            <img
                              src={track.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop"}
                              alt={track.title}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop";
                              }}
                              className="w-full h-full object-cover"
                            />
                            <div
                              className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
                                isTrackPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              {isTrackPlaying ? (
                                <Pause size={16} className="fill-white text-white" />
                              ) : (
                                <Play size={16} className="fill-white text-white ml-0.5" />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col overflow-hidden min-w-0">
                            <span
                              className={`text-sm font-semibold truncate ${
                                isTrackCurrent ? "text-spotify-green" : "text-white"
                              }`}
                            >
                              {track.title}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-[#b3b3b3] truncate">
                              <span className="truncate">
                                {(track.artist?.name || "Various Artists")
                                  .split(",")
                                  .map((a) => a.trim())
                                  .filter(Boolean)
                                  .map((name, i, arr) => {
                                    const artId =
                                      (i === 0 && (track.artistId || track.artist?.id)) ||
                                      `art_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
                                    return (
                                      <React.Fragment key={`${artId}_${i}`}>
                                        <span
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/artist/${artId}`);
                                          }}
                                          className="hover:text-white hover:underline cursor-pointer"
                                        >
                                          {name}
                                        </span>
                                        {i < arr.length - 1 && <span className="text-[#777] mr-1">,</span>}
                                      </React.Fragment>
                                    );
                                  })}
                              </span>
                              {track.id.startsWith("yt_") && (
                                <span className="text-[10px] px-1 py-0.2 rounded bg-red-600/30 text-red-400 font-semibold shrink-0">
                                  YouTube
                                </span>
                              )}
                              {track.id.startsWith("itunes_") && (
                                <span className="text-[10px] px-1 py-0.2 rounded bg-spotify-green/20 text-spotify-green font-semibold shrink-0">
                                  Spotify
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Like Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLikeTrack(track);
                            }}
                            className={`p-1.5 transition-all hover:scale-110 active:scale-90 ${
                              liked ? "text-spotify-green opacity-100" : "text-[#b3b3b3] opacity-0 group-hover:opacity-100 hover:text-white"
                            }`}
                            aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                            title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                            data-testid="search-track-like-button"
                          >
                            <Heart size={16} className={liked ? "fill-spotify-green" : ""} />
                          </button>

                          {/* Duration */}
                          <span className="text-xs text-[#b3b3b3] font-mono mr-2">
                            {Math.floor(track.duration / 60)}:
                            {(track.duration % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tracks Table if filtered to Songs, YouTube, or Spotify */}
          {(filter === "tracks" || filter === "youtube" || filter === "spotify") && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">
                  {filter === "youtube" ? "YouTube Music & Streams" : filter === "spotify" ? "Spotify Master Releases" : "Songs"}
                </h3>
                <span className="text-xs text-[#b3b3b3]">
                  {searchResults.tracks.length} {searchResults.tracks.length === 1 ? "track" : "tracks"} found
                </span>
              </div>
              <TrackTable tracks={searchResults.tracks} />
            </div>
          )}

          {/* Artists Section */}
          {(filter === "all" || filter === "artists") && searchResults.artists.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Artists</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {searchResults.artists.map((art) => (
                  <MediaCard
                    key={art.id}
                    id={art.id}
                    type="artist"
                    title={art.name}
                    subtitle="Artist"
                    imageUrl={art.avatarUrl}
                    targetUrl={`/artist/${art.id}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Albums Section */}
          {(filter === "all" || filter === "albums") && searchResults.albums.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Albums</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {searchResults.albums.map((alb) => (
                  <MediaCard
                    key={alb.id}
                    id={alb.id}
                    type="album"
                    title={alb.title}
                    subtitle={`${alb.releaseYear} • ${alb.artist?.name || "Album"}`}
                    imageUrl={alb.coverUrl}
                    targetUrl={`/album/${alb.id}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Playlists Section */}
          {(filter === "all" || filter === "playlists") && searchResults.playlists.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Playlists</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {searchResults.playlists.map((pl) => (
                  <MediaCard
                    key={pl.id}
                    id={pl.id}
                    type="playlist"
                    title={pl.title}
                    subtitle={`By ${pl.owner?.displayName || "Spotify"}`}
                    imageUrl={pl.coverUrl}
                    tracks={pl.tracks}
                    playContext={pl.tracks}
                    targetUrl={`/playlist/${pl.id}`}
                  />
                ))}
              </div>
            </div>
          )}

          {searchResults.tracks.length === 0 &&
            searchResults.artists.length === 0 &&
            searchResults.albums.length === 0 &&
            searchResults.playlists.length === 0 && (
              <div className="py-20 text-center text-[#b3b3b3]">
                <p className="text-lg font-bold text-white mb-1">
                  No results found for &quot;{query}&quot;
                </p>
                <p className="text-sm">
                  Please make sure your words are spelled correctly, or use fewer or different keywords.
                </p>
              </div>
            )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[#b3b3b3]">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
