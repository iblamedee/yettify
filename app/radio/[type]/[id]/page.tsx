import { notFound } from "next/navigation";
import { generateRadioStation } from "@/lib/recommendationEngine";
import { MediaHeader } from "@/components/media/MediaHeader";
import { TrackTable } from "@/components/track/TrackTable";

export const revalidate = 60;

export default async function RadioPage({
  params,
}: {
  params: { type: "track" | "artist"; id: string };
}) {
  const station = await generateRadioStation(params.type, params.id);

  if (!station || !station.tracks || station.tracks.length === 0) {
    notFound();
  }

  const totalDuration = station.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  return (
    <div className="pb-16">
      <MediaHeader
        type="Playlist"
        title={station.title}
        coverUrl={station.coverUrl}
        creatorName="Spotify"
        creatorAvatar="https://i.scdn.co/image/ab6775700000b8a855c25988a6ac314394d3fbf5"
        creatorType="user"
        trackCount={station.tracks.length}
        totalDurationSeconds={totalDuration}
        tracks={station.tracks}
        gradientColor="rgba(40, 80, 70, 0.7)"
      />

      {station.subtitle && (
        <p className="text-sm text-[#b3b3b3] mb-6 px-1 italic">{station.subtitle}</p>
      )}

      {/* Radio Tracks Table */}
      <TrackTable tracks={station.tracks} showAlbum={true} />
    </div>
  );
}
