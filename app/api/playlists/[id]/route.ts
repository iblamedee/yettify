import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, displayName: true, avatarUrl: true } },
        tracks: {
          include: {
            track: {
              include: { artist: true, album: true },
            },
          },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    return NextResponse.json({ playlist });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id: params.id },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    if (playlist.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Not playlist owner" }, { status: 403 });
    }

    const { title, description, coverUrl, isPublic } = await req.json();

    const updated = await prisma.playlist.update({
      where: { id: params.id },
      data: {
        title: title !== undefined ? title : playlist.title,
        description: description !== undefined ? description : playlist.description,
        coverUrl: coverUrl !== undefined ? (coverUrl || null) : playlist.coverUrl,
        isPublic: isPublic !== undefined ? isPublic : playlist.isPublic,
      },
      include: {
        owner: { select: { id: true, displayName: true } },
      },
    });

    return NextResponse.json({ playlist: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id: params.id },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    if (playlist.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Not playlist owner" }, { status: 403 });
    }

    await prisma.playlist.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
