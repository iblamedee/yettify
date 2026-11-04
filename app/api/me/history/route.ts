import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ history: [] });
    }

    const history = await prisma.playHistory.findMany({
      where: { userId: user.id },
      include: {
        track: {
          include: { artist: true, album: true },
        },
      },
      orderBy: { playedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: true, message: "Guest play not saved to history" });
    }

    const { trackId } = await req.json();
    if (!trackId) {
      return NextResponse.json({ error: "trackId is required" }, { status: 400 });
    }

    // Check if track exists in database
    const existingTrack = await prisma.track.findUnique({
      where: { id: trackId },
    });

    if (existingTrack) {
      await prisma.track.update({
        where: { id: trackId },
        data: { streamCount: { increment: 1 } },
      });

      const entry = await prisma.playHistory.create({
        data: {
          userId: user.id,
          trackId,
        },
      });

      return NextResponse.json({ success: true, entry }, { status: 201 });
    }

    return NextResponse.json({ success: true, message: "External/global track playback recorded" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
