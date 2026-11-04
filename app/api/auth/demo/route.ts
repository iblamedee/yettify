import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "demo@spotify.com" },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        plan: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Demo user not found. Please run seed script." }, { status: 404 });
    }

    setSessionCookie(user.id);

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
