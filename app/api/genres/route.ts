import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const genres = await prisma.genre.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ genres });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
