import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      // Default preferences for guests
      return NextResponse.json({
        preferences: {
          autoplay: true,
          crossfadeSeconds: 0,
          normalizeVolume: true,
          audioQuality: "HIGH",
          explicitContentFilter: false,
          language: "en",
        },
      });
    }

    let prefs = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
    });

    if (!prefs) {
      prefs = await prisma.userPreferences.create({
        data: {
          userId: user.id,
          autoplay: true,
          crossfadeSeconds: 0,
          normalizeVolume: true,
          audioQuality: "HIGH",
          explicitContentFilter: false,
          language: "en",
        },
      });
    }

    return NextResponse.json({ preferences: prefs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    const updated = await prisma.userPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ preferences: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
