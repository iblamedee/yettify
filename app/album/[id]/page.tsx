import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AlbumHeaderClient } from "@/components/media/AlbumHeaderClient";
import { TrackTable } from "@/components/track/TrackTable";
import { MediaCard } from "@/components/media/MediaCard";
import { ensureAlbumInDb } from "@/lib/musicEngine";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params }: { params: { id: string } }) {
  let album = await prisma.album.findUnique({
    where: { id: params.id },
    include: {
      artist: true,
      tracks: {
        include: { artist: true, album: true },
        orderBy: { trackNumber: "asc" },
      },
    },
  });

  if (!album) {
    album = await ensureAlbumInDb(params.id);
  }

  if (!album) {
    notFound();
  }

  // Calculate total duration in seconds
  const totalSeconds = album.tracks.reduce((acc, t) => acc + t.duration, 0);

  // More albums by this artist
  const moreByArtist = await prisma.album.findMany({
    where: {
      artistId: album.artistId,
      id: { not: album.id },
    },
    take: 6,
  });

  return (
    <div className="pb-16">
      {/* Album Header with Save to Library */}
      <AlbumHeaderClient album={album} totalDurationSeconds={totalSeconds} />

      {/* Tracklist Table */}
      <div className="mb-12">
        <TrackTable tracks={album.tracks} showAlbum={false} />
      </div>

      {/* Copyright Metadata */}
      {album.copyright && (
        <div className="text-xs text-[#b3b3b3] space-y-1 py-4 border-t border-[#282828] mb-8">
          {album.releaseDate && <p>{album.releaseDate}</p>}
          <p>{album.copyright}</p>
        </div>
      )}

      {/* More by Artist */}
      {moreByArtist.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">
            More by {album.artist.name}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {moreByArtist.map((alb) => (
              <MediaCard
                key={alb.id}
                id={alb.id}
                type="album"
                title={alb.title}
                subtitle={`${alb.releaseYear} • Album`}
                imageUrl={alb.coverUrl}
                targetUrl={`/album/${alb.id}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
