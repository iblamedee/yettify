import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureTrackInDb } from "@/lib/musicEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ trackIds: [], tracks: [] });
    }

    const likes = await prisma.userLikedTrack.findMany({
      where: { userId: user.id },
      include: {
        track: {
          include: { artist: true, album: true },
        },
      },
      orderBy: { likedAt: "desc" },
    });

    const trackIds = likes.map((l) => l.trackId);
    const tracks = likes.map((l) => ({
      ...l.track,
      likedAt: l.likedAt,
    }));

    return NextResponse.json({ trackIds, tracks });
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
    const trackId = body.trackId;
    const trackData = body.track;

    if (!trackId) {
      return NextResponse.json({ error: "trackId is required" }, { status: 400 });
    }

    // Ensure track exists in database before creating like relation
    let dbTrack = await prisma.track.findUnique({
      where: { id: trackId },
      include: { artist: true, album: true },
    });

    if (!dbTrack && trackData) {
      dbTrack = await ensureTrackInDb(trackData);
    }

    if (!dbTrack) {
      return NextResponse.json({ error: "Track not found and could not be resolved" }, { status: 404 });
    }

    const liked = await prisma.userLikedTrack.upsert({
      where: {
        userId_trackId: {
          userId: user.id,
          trackId: dbTrack.id,
        },
      },
      create: {
        userId: user.id,
        trackId: dbTrack.id,
      },
      update: {},
      include: {
        track: {
          include: { artist: true, album: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        track: {
          ...liked.track,
          likedAt: liked.likedAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/me/likes/tracks error:", error);
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
    const trackId = searchParams.get("trackId");

    if (!trackId) {
      return NextResponse.json({ error: "trackId is required" }, { status: 400 });
    }

    await prisma.userLikedTrack.deleteMany({
      where: {
        userId: user.id,
        trackId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
