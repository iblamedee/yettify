import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const album = await prisma.album.findUnique({
      where: { id: params.id },
      include: {
        artist: true,
        tracks: {
          include: { artist: true },
          orderBy: { trackNumber: "asc" },
        },
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    // Other albums by this artist
    const moreByArtist = await prisma.album.findMany({
      where: {
        artistId: album.artistId,
        id: { not: album.id },
      },
      take: 6,
    });

    return NextResponse.json({ album, moreByArtist });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
