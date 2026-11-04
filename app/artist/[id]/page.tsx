import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ArtistHeaderClient } from "@/components/media/ArtistHeaderClient";
import { TrackTable } from "@/components/track/TrackTable";
import { MediaCard } from "@/components/media/MediaCard";
import { formatNumberWithCommas } from "@/lib/utils";
import { ensureArtistInDb } from "@/lib/musicEngine";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function ArtistPage({ params }: { params: { id: string } }) {
  let artist = await prisma.artist.findUnique({
    where: { id: params.id },
    include: {
      tracks: {
        include: { artist: true, album: true },
        orderBy: { streamCount: "desc" },
        take: 10,
      },
      albums: {
        orderBy: { releaseYear: "desc" },
      },
    },
  });

  if (!artist) {
    artist = await ensureArtistInDb(params.id);
  }

  if (!artist) {
    notFound();
  }

  // Related artists
  const related = await prisma.artist.findMany({
    where: { id: { not: artist.id } },
    take: 6,
  });

  return (
    <div className="pb-16">
      {/* Artist Header with Follow/Following */}
      <ArtistHeaderClient artist={artist} />

      {/* Popular Tracks Table */}
      <div className="mb-12">
        <h3 className="text-2xl font-bold text-white mb-4">Popular</h3>
        <TrackTable tracks={artist.tracks} showAlbum={true} />
      </div>

      {/* Discography */}
      {artist.albums.length > 0 && (
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-white mb-4">Discography</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artist.albums.map((alb) => (
              <MediaCard
                key={alb.id}
                id={alb.id}
                type="album"
                title={alb.title}
                subtitle={`${alb.releaseYear} • ${alb.type}`}
                imageUrl={alb.coverUrl}
                targetUrl={`/album/${alb.id}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fans Also Like */}
      {related.length > 0 && (
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-white mb-4">Fans also like</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {related.map((art) => (
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

      {/* About Section */}
      {artist.bio && (
        <div>
          <h3 className="text-2xl font-bold text-white mb-4">About</h3>
          <div className="p-6 md:p-8 rounded-xl bg-[#242424] max-w-3xl space-y-4">
            {artist.rankGlobal && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white">#{artist.rankGlobal}</span>
                <span className="text-sm font-semibold text-[#b3b3b3]">in the world</span>
              </div>
            )}
            <p className="text-base font-bold text-white">
              {formatNumberWithCommas(artist.monthlyListeners)} monthly listeners
            </p>
            <p className="text-sm text-[#e0e0e0] leading-relaxed whitespace-pre-line">
              {artist.bio}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
