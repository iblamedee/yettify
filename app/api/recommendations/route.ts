import { NextResponse } from "next/server";
import { getRecommendationsForTrack, getRecommendationsForArtist } from "@/lib/recommendationEngine";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const seedTrack = searchParams.get("seed_tracks");
    const seedArtist = searchParams.get("seed_artists");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    let tracks: any[] = [];
    if (seedTrack) {
      tracks = await getRecommendationsForTrack(seedTrack, limit);
    } else if (seedArtist) {
      tracks = await getRecommendationsForArtist(seedArtist, limit);
    } else {
      // Default to popular artist
      tracks = await getRecommendationsForArtist("Sabrina Carpenter", limit);
    }

    return NextResponse.json({
      tracks,
      seed: {
        track: seedTrack,
        artist: seedArtist,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
