import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const artist = await prisma.artist.findUnique({
      where: { id: params.id },
      include: {
        tracks: {
          include: { album: true, artist: true },
          orderBy: { streamCount: "desc" },
          take: 10,
        },
        albums: {
          orderBy: { releaseYear: "desc" },
        },
      },
    });

    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    // Related artists (other top artists)
    const related = await prisma.artist.findMany({
      where: { id: { not: artist.id } },
      take: 6,
    });

    return NextResponse.json({ artist, related });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
