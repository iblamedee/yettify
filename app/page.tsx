import { prisma } from "@/lib/prisma";
import { MediaCard } from "@/components/media/MediaCard";
import { getGreeting } from "@/lib/utils";
import { Heart, Play } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const greeting = getGreeting();

  // Fetch home sections data with fallback
  let artists: any[] = [];
  let albums: any[] = [];
  let playlists: any[] = [];
  let trendingTracks: any[] = [];

  try {
    const res = await Promise.all([
      prisma.artist.findMany({
        take: 6,
        orderBy: { monthlyListeners: "desc" },
      }),
      prisma.album.findMany({
        take: 6,
        include: { artist: true, tracks: true },
        orderBy: { releaseYear: "desc" },
      }),
      prisma.playlist.findMany({
        where: { isPublic: true },
        take: 6,
        include: {
          owner: { select: { displayName: true } },
          tracks: { include: { track: { include: { artist: true, album: true } } } },
        },
      }),
      prisma.track.findMany({
        take: 6,
        include: { artist: true, album: true },
        orderBy: { streamCount: "desc" },
      }),
    ]);
    artists = res[0];
    albums = res[1];
    playlists = res[2];
    trendingTracks = res[3];
  } catch (err) {
    console.error("HomePage data load error:", err);
  }

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header Greeting & Quick Links Grid */}
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
          {greeting}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Liked Songs Quick Card */}
          <Link
            href="/collection/tracks"
            className="flex items-center gap-3 bg-[#282828]/60 hover:bg-[#282828] rounded-md overflow-hidden transition-colors group shadow-sm"
          >
            <div className="w-16 h-16 bg-gradient-purple flex items-center justify-center shrink-0">
              <Heart size={24} className="fill-white text-white" />
            </div>
            <span className="font-bold text-sm text-white truncate flex-1">
              Liked Songs
            </span>
            <div className="w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center mr-4 opacity-0 group-hover:opacity-100 transition-opacity shadow-spotify-play">
              <Play size={18} className="fill-black ml-0.5" />
            </div>
          </Link>

          {/* Album & Playlist Quick Cards */}
          {albums.slice(0, 5).map((alb) => (
            <Link
              key={alb.id}
              href={`/album/${alb.id}`}
              className="flex items-center gap-3 bg-[#282828]/60 hover:bg-[#282828] rounded-md overflow-hidden transition-colors group shadow-sm"
            >
              <img
                src={alb.coverUrl}
                alt={alb.title}
                loading="lazy"
                decoding="async"
                className="w-16 h-16 object-cover shrink-0"
              />
              <span className="font-bold text-sm text-white truncate flex-1">
                {alb.title}
              </span>
              <div className="w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center mr-4 opacity-0 group-hover:opacity-100 transition-opacity shadow-spotify-play">
                <Play size={18} className="fill-black ml-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 2. Trending Songs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl md:text-2xl font-bold text-white hover:underline cursor-pointer">
            Trending songs
          </h3>
          <span className="text-xs font-bold text-[#b3b3b3] hover:underline cursor-pointer">
            Show all
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {trendingTracks.map((trk) => (
            <MediaCard
              key={trk.id}
              id={trk.id}
              type="track"
              title={trk.title}
              subtitle={trk.artist?.name}
              imageUrl={trk.album?.coverUrl}
              targetUrl={`/album/${trk.albumId}`}
              playContext={trk}
            />
          ))}
        </div>
      </div>

      {/* 3. Popular Artists */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl md:text-2xl font-bold text-white hover:underline cursor-pointer">
            Popular artists
          </h3>
          <span className="text-xs font-bold text-[#b3b3b3] hover:underline cursor-pointer">
            Show all
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {artists.map((art) => (
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

      {/* 4. Popular Albums and Singles */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl md:text-2xl font-bold text-white hover:underline cursor-pointer">
            Popular albums and singles
          </h3>
          <span className="text-xs font-bold text-[#b3b3b3] hover:underline cursor-pointer">
            Show all
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {albums.map((alb) => (
            <MediaCard
              key={alb.id}
              id={alb.id}
              type="album"
              title={alb.title}
              subtitle={`${alb.releaseYear} • ${alb.artist?.name || "Artist"}`}
              imageUrl={alb.coverUrl}
              targetUrl={`/album/${alb.id}`}
              playContext={alb.tracks}
            />
          ))}
        </div>
      </div>

      {/* 5. Popular Radio Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl md:text-2xl font-bold text-white hover:underline cursor-pointer">
            Popular radio
          </h3>
          <span className="text-xs font-bold text-[#b3b3b3] hover:underline cursor-pointer">
            Show all
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[
            {
              id: "radio_art_sabrina",
              title: "Sabrina Carpenter Radio",
              subtitle: "With Chappell Roan, Olivia Rodrigo, Billie Eilish and more",
              imageUrl: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_sabrina",
            },
            {
              id: "radio_art_billie",
              title: "Billie Eilish Radio",
              subtitle: "With Lorde, Lana Del Rey, FINNEAS and more",
              imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_billie",
            },
            {
              id: "radio_art_kendrick",
              title: "Kendrick Lamar Radio",
              subtitle: "With SZA, Drake, J. Cole, Travis Scott and more",
              imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_kendrick",
            },
            {
              id: "radio_art_weeknd",
              title: "The Weeknd Radio",
              subtitle: "With Post Malone, Bruno Mars, Dua Lipa and more",
              imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_weeknd",
            },
            {
              id: "radio_art_taylor",
              title: "Taylor Swift Radio",
              subtitle: "With Olivia Rodrigo, Chappell Roan, Gracie Abrams and more",
              imageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_taylor",
            },
          ].map((radio) => (
            <MediaCard
              key={radio.id}
              id={radio.id}
              type="playlist"
              title={radio.title}
              subtitle={radio.subtitle}
              imageUrl={radio.imageUrl}
              targetUrl={radio.targetUrl}
            />
          ))}
        </div>
      </div>

      {/* 6. Made For You Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl md:text-2xl font-bold text-white hover:underline cursor-pointer">
            Made For You
          </h3>
          <span className="text-xs font-bold text-[#b3b3b3] hover:underline cursor-pointer">
            Show all
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {[
            {
              id: "mix_daily_1",
              title: "Daily Mix 1",
              subtitle: "Sabrina Carpenter, Billie Eilish, Olivia Rodrigo and more",
              imageUrl: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_sabrina",
            },
            {
              id: "mix_daily_2",
              title: "Daily Mix 2",
              subtitle: "Kendrick Lamar, Drake, SZA and more",
              imageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_kendrick",
            },
            {
              id: "mix_discover_weekly",
              title: "Discover Weekly",
              subtitle: "Your weekly mixtape of fresh music and deep cuts chosen just for you.",
              imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_billie",
            },
            {
              id: "mix_release_radar",
              title: "Release Radar",
              subtitle: "Catch all the latest music from artists you follow and fresh tracks for you.",
              imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
              targetUrl: "/radio/artist/art_taylor",
            },
          ].map((mix) => (
            <MediaCard
              key={mix.id}
              id={mix.id}
              type="playlist"
              title={mix.title}
              subtitle={mix.subtitle}
              imageUrl={mix.imageUrl}
              targetUrl={mix.targetUrl}
            />
          ))}
        </div>
      </div>

      {/* 7. Featured Playlists */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl md:text-2xl font-bold text-white hover:underline cursor-pointer">
            Featured Playlists
          </h3>
          <span className="text-xs font-bold text-[#b3b3b3] hover:underline cursor-pointer">
            Show all
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {playlists.map((pl) => (
            <MediaCard
              key={pl.id}
              id={pl.id}
              type="playlist"
              title={pl.title}
              subtitle={pl.description || `By ${pl.owner?.displayName || "Spotify"}`}
              imageUrl={pl.coverUrl}
              tracks={pl.tracks.map((pt: any) => pt.track)}
              targetUrl={`/playlist/${pl.id}`}
              playContext={pl.tracks.map((pt: any) => pt.track)}
            />
          ))}
        </div>
      </div>

      {/* 6. Footer Section */}
      <footer className="mt-16 pt-8 border-t border-[#282828] text-xs text-[#b3b3b3] space-y-4">
        <div className="flex flex-wrap gap-6">
          <Link href="/premium" className="hover:text-white hover:underline">
            Premium
          </Link>
          <Link href="/preferences" className="hover:text-white hover:underline">
            Settings
          </Link>
          <a
            href="https://open.spotify.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white hover:underline"
          >
            Spotify Reference
          </a>
        </div>
        <div className="flex items-center justify-between pt-4">
          <span>© 2026 Spotify Web Reconstruction</span>
          <span className="text-[11px] text-[#6a6a6a]">
            Educational & Reverse-Engineering Architecture
          </span>
        </div>
      </footer>
    </div>
  );
}
