import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureAlbumInDb } from "@/lib/musicEngine";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ albumIds: [], albums: [] });
    }

    const saved = await prisma.userSavedAlbum.findMany({
      where: { userId: user.id },
      include: {
        album: {
          include: { artist: true, tracks: true },
        },
      },
      orderBy: { savedAt: "desc" },
    });

    return NextResponse.json({
      albumIds: saved.map((s) => s.albumId),
      albums: saved.map((s) => s.album),
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
    const albumId = body.albumId;
    if (!albumId) {
      return NextResponse.json({ error: "albumId is required" }, { status: 400 });
    }

    let album = await prisma.album.findUnique({ where: { id: albumId } });
    if (!album) {
      album = await ensureAlbumInDb(albumId);
    }

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    await prisma.userSavedAlbum.upsert({
      where: {
        userId_albumId: { userId: user.id, albumId: album.id },
      },
      create: { userId: user.id, albumId: album.id },
      update: {},
    });

    return NextResponse.json({ success: true, album }, { status: 201 });
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
    const albumId = searchParams.get("albumId");

    if (!albumId) {
      return NextResponse.json({ error: "albumId is required" }, { status: 400 });
    }

    await prisma.userSavedAlbum.deleteMany({
      where: { userId: user.id, albumId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
