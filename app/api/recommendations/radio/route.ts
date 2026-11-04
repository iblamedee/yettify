import { NextResponse } from "next/server";
import { generateRadioStation } from "@/lib/recommendationEngine";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") as "track" | "artist") || "artist";
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Seed ID is required" }, { status: 400 });
    }

    const station = await generateRadioStation(type, id);
    if (!station) {
      return NextResponse.json({ error: "Radio station not found" }, { status: 404 });
    }

    return NextResponse.json(station);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
