import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const trackId = body.trackId;
    const trackData = body.track;

    if (!trackId) {
      return NextResponse.json({ error: "trackId is required" }, { status: 400 });
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id: params.id },
      include: { tracks: true },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    // Check if track is already in playlist
    const existing = playlist.tracks.find((pt) => pt.trackId === trackId);
    if (existing) {
      return NextResponse.json({ error: "Track already in playlist" }, { status: 400 });
    }

    // Ensure track exists in database (auto-persist if recommended/global track)
    let targetTrack = await prisma.track.findUnique({ where: { id: trackId } });
    if (!targetTrack && trackData) {
      const artistName = trackData.artist?.name || "Various Artists";
      let artist = await prisma.artist.findFirst({
        where: { name: artistName },
      });
      if (!artist) {
        artist = await prisma.artist.create({
          data: {
            id: `art_${Date.now()}`,
            name: artistName,
            avatarUrl: trackData.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
          },
        });
      }

      const albumTitle = trackData.album?.title || trackData.title;
      let album = await prisma.album.findFirst({
        where: { title: albumTitle },
      });
      if (!album) {
        album = await prisma.album.create({
          data: {
            id: `alb_${Date.now()}`,
            title: albumTitle,
            coverUrl: trackData.album?.coverUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
            releaseYear: 2024,
            artistId: artist.id,
          },
        });
      }

      targetTrack = await prisma.track.create({
        data: {
          id: trackId,
          title: trackData.title,
          duration: trackData.duration || 210,
          audioUrl: trackData.audioUrl || "",
          streamCount: trackData.streamCount || 500000,
          explicit: Boolean(trackData.explicit),
          artistId: artist.id,
          albumId: album.id,
        },
      });
    }

    const nextPosition = playlist.tracks.length;

    const added = await prisma.playlistTrack.create({
      data: {
        playlistId: params.id,
        trackId,
        position: nextPosition,
        addedById: user.id,
      },
      include: {
        track: { include: { artist: true, album: true } },
      },
    });

    return NextResponse.json({ track: added }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
