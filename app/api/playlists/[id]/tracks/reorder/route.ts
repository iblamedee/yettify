import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id: params.id },
      include: {
        tracks: { orderBy: { position: "asc" } },
      },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    if (playlist.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Not playlist owner" }, { status: 403 });
    }

    const { trackId, newPosition } = await req.json();

    const trackList = [...playlist.tracks];
    const currentIndex = trackList.findIndex((t) => t.trackId === trackId);
    if (currentIndex === -1) {
      return NextResponse.json({ error: "Track not in playlist" }, { status: 400 });
    }

    const [moved] = trackList.splice(currentIndex, 1);
    trackList.splice(newPosition, 0, moved);

    // Update positions in transaction
    await prisma.$transaction(
      trackList.map((item, index) =>
        prisma.playlistTrack.update({
          where: { id: item.id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
