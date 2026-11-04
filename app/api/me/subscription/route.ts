import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await req.json();
    if (!plan || !["FREE", "PREMIUM", "DUO", "FAMILY", "STUDENT"].includes(plan.toUpperCase())) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { plan: plan.toUpperCase() },
      select: {
        id: true,
        email: true,
        displayName: true,
        plan: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
