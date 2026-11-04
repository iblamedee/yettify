import { NextResponse } from "next/server";
import { getRecommendationsForPlaylist } from "@/lib/recommendationEngine";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "8", 10);

    const tracks = await getRecommendationsForPlaylist(params.id, limit);

    return NextResponse.json({
      playlistId: params.id,
      tracks,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
