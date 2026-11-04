import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();

    let playlists;
    if (user) {
      playlists = await prisma.playlist.findMany({
        where: {
          OR: [{ ownerId: user.id }, { isPublic: true }],
        },
        include: {
          owner: { select: { id: true, displayName: true } },
          tracks: {
            include: { track: { include: { artist: true, album: true } } },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    } else {
      playlists = await prisma.playlist.findMany({
        where: { isPublic: true },
        include: {
          owner: { select: { id: true, displayName: true } },
          tracks: {
            include: { track: { include: { artist: true, album: true } } },
            orderBy: { position: "asc" },
          },
        },
        take: 20,
      });
    }

    return NextResponse.json({ playlists });
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

    const { title, description } = await req.json();

    const playlist = await prisma.playlist.create({
      data: {
        title: title || "My Playlist",
        description: description || "",
        isPublic: true,
        ownerId: user.id,
      },
      include: {
        owner: { select: { id: true, displayName: true } },
        tracks: true,
      },
    });

    return NextResponse.json({ playlist }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
