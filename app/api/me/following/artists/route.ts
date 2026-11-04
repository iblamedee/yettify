import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureArtistInDb } from "@/lib/musicEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ artistIds: [], artists: [] });
    }

    const following = await prisma.userFollowedArtist.findMany({
      where: { userId: user.id },
      include: { artist: true },
      orderBy: { followedAt: "desc" },
    });

    return NextResponse.json({
      artistIds: following.map((f) => f.artistId),
      artists: following.map((f) => f.artist),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const artistId = body.artistId;
    if (!artistId) {
      return NextResponse.json({ error: "artistId is required" }, { status: 400 });
    }

    let artist = await prisma.artist.findUnique({ where: { id: artistId } });
    if (!artist) {
      artist = await ensureArtistInDb(artistId);
    }

    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    await prisma.userFollowedArtist.upsert({
      where: {
        userId_artistId: { userId: user.id, artistId: artist.id },
      },
      create: { userId: user.id, artistId: artist.id },
      update: {},
    });

    return NextResponse.json({ success: true, artist }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const artistId = searchParams.get("artistId");

    if (!artistId) {
      return NextResponse.json({ error: "artistId is required" }, { status: 400 });
    }

    await prisma.userFollowedArtist.deleteMany({
      where: { userId: user.id, artistId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
