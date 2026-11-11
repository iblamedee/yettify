import { NextRequest, NextResponse } from "next/server";
import {
  resolveAudioForTrack,
  checkJioSaavnVerified,
  searchJioSaavn,
  stripTrackArtifacts,
  FORBIDDEN_COVER_KEYWORDS,
} from "@/lib/musicEngine";
import { resolveStreamQuality } from "@/lib/audioQuality";

export const dynamic = "force-dynamic";

// In-memory cache for resolved audio URLs (lasts ~6 hours)
const streamCache = new Map<string, { url: string; expires: number }>();

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    let ytId = searchParams.get("ytId");
    const q = searchParams.get("q");
    const title = searchParams.get("title");
    const artist = searchParams.get("artist") || "";
    const redirect = searchParams.get("redirect") === "true";
    const directUrl = searchParams.get("url");
    const isJsonRequested =
      req.headers.get("accept")?.includes("application/json") ||
      searchParams.get("format") === "json";

    // 1. Direct URL pass-through
    if (directUrl) {
      if (isJsonRequested) {
        const qualityInfo = resolveStreamQuality(directUrl);
        return NextResponse.json({
          success: true,
          audioUrl: directUrl,
          bitrate: qualityInfo.bitrate,
          qualityTier: qualityInfo.tier,
        });
      }
      return NextResponse.redirect(directUrl, 302);
    }

    // 2. Studio-First query search resolution with strict validation & cover-filtering
    // Prioritize high-bitrate studio master from JioSaavn CDN (zero bot detection risk on cloud IPs)
    // ONLY when ytId is NOT specified. If a specific ytId was requested, do not hijack it.
    if (!ytId && (q || title)) {
      let resolvedTitle = title || "";
      let resolvedArtist = artist || "";

      if (!resolvedTitle && q) {
        // 1. Check if an existing track in database matches this audioUrl or query
        try {
          const { prisma } = await import("@/lib/prisma");
          const reqPathAndQuery = req.nextUrl.pathname + req.nextUrl.search;
          const dbTrack = await prisma.track.findFirst({
            where: {
              OR: [
                { audioUrl: reqPathAndQuery },
                { audioUrl: `/api/stream?q=${encodeURIComponent(q)}` },
                { audioUrl: `/api/stream?q=${q}` },
                { title: { equals: q } },
              ],
            },
            include: { artist: true },
          });

          if (dbTrack) {
            resolvedTitle = dbTrack.title;
            resolvedArtist = dbTrack.artist?.name || "";
          }
        } catch {
          // ignore
        }

        // 2. If still not resolved, check patterns in q
        if (!resolvedTitle) {
          if (q.includes(" - ")) {
            const parts = q.split(" - ");
            resolvedArtist = parts[0].trim();
            resolvedTitle = parts.slice(1).join(" - ").trim();
          } else if (q.toLowerCase().includes(" by ")) {
            const parts = q.split(/\s+by\s+/i);
            resolvedTitle = parts[0].trim();
            resolvedArtist = parts.slice(1).join(" by ").trim();
          } else {
            try {
              const { prisma } = await import("@/lib/prisma");
              const artistsInDb = await prisma.artist.findMany({ select: { name: true } });
              const foundArtist = artistsInDb.find((a) =>
                q.toLowerCase().includes(a.name.toLowerCase())
              );
              if (foundArtist) {
                resolvedArtist = foundArtist.name;
                resolvedTitle = q.replace(new RegExp(foundArtist.name, "gi"), "").trim();
              } else {
                resolvedTitle = q.trim();
              }
            } catch {
              resolvedTitle = q.trim();
            }
          }
        }
      }

      const durationNum = parseInt(searchParams.get("duration") || "0", 10);
      const bitrateParam = searchParams.get("bitrate");
      const targetBitrate: "96" | "160" | "320" =
        bitrateParam === "96" || bitrateParam === "160" ? bitrateParam : "320";

      const resolved = await resolveAudioForTrack(
        resolvedTitle,
        resolvedArtist,
        targetBitrate,
        durationNum > 0 ? durationNum : undefined
      );

      if (resolved?.audioUrl) {
        if (resolved.source === "jiosaavn" && resolved.audioUrl.startsWith("http")) {
          if (isJsonRequested) {
            const qualityInfo = resolveStreamQuality(resolved.audioUrl, "jiosaavn");
            return NextResponse.json({
              success: true,
              audioUrl: resolved.audioUrl,
              source: "jiosaavn",
              duration: resolved.duration,
              bitrate: qualityInfo.bitrate,
              qualityTier: qualityInfo.tier,
            });
          }
          return NextResponse.redirect(resolved.audioUrl, 302);
        }

        if (resolved.ytId) {
          ytId = resolved.ytId;
        } else if (resolved.audioUrl.includes("ytId=")) {
          const m = resolved.audioUrl.match(/ytId=([a-zA-Z0-9_-]+)/);
          if (m) ytId = m[1];
        }

        if (isJsonRequested && ytId) {
          const qualityInfo = resolveStreamQuality(resolved.audioUrl, "youtube");
          return NextResponse.json({
            success: true,
            ytId,
            audioUrl: resolved.audioUrl,
            source: "youtube",
            duration: resolved.duration,
            bitrate: qualityInfo.bitrate,
            qualityTier: qualityInfo.tier,
          });
        }
      }
    }

    // 3. YouTube Audio Streaming with Studio-Master Fallback (Zero 30s cutoffs, zero bot failure)
    if (ytId) {
      let resolvedUrl: string | null = null;
      let resolvedSource: "youtube" | "jiosaavn" = "youtube";

      const cached = streamCache.get(ytId);
      if (cached && cached.expires > Date.now()) {
        resolvedUrl = cached.url;
        resolvedSource = "jiosaavn";
      } else {
        // Fast JioSaavn Studio Master Resolution (~100ms, zero bot risk, full 320kbps CDN audio)
        try {
          let candidateTitle = title || "";
          let candidateArtist = artist || "";

          // Fast zero-bot YouTube oEmbed endpoint if title is missing
          if (!candidateTitle && ytId) {
            try {
              const oembedRes = await fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
                { signal: AbortSignal.timeout(1200) }
              );
              if (oembedRes.ok) {
                const oData = await oembedRes.json();
                const rawTitle = oData.title || "";
                const rawAuthor = (oData.author_name || "")
                  .replace(/\s*-\s*Topic$/i, "")
                  .replace(/VEVO$/i, "")
                  .trim();

                if (rawTitle.includes(" - ")) {
                  const parts = rawTitle.split(" - ");
                  candidateArtist = parts[0].trim();
                  candidateTitle = parts.slice(1).join(" - ").trim();
                } else {
                  candidateTitle = rawTitle;
                  if (!candidateArtist && rawAuthor) {
                    candidateArtist = rawAuthor;
                  }
                }
              }
            } catch {}
          }

          const isAlternateOrCover = FORBIDDEN_COVER_KEYWORDS.some((kw) =>
            candidateTitle.toLowerCase().includes(kw)
          );

          if (candidateTitle && !isAlternateOrCover) {
            const durationNum = parseInt(searchParams.get("duration") || "0", 10);
            const bitrateParam = searchParams.get("bitrate");
            const targetBitrate: "96" | "160" | "320" =
              bitrateParam === "96" || bitrateParam === "160" ? bitrateParam : "320";

            const saavnRes = await checkJioSaavnVerified(
              candidateTitle,
              candidateArtist,
              durationNum > 0 ? durationNum : undefined,
              targetBitrate
            );

            if (saavnRes?.audioUrl && saavnRes.audioUrl.startsWith("http")) {
              resolvedUrl = saavnRes.audioUrl;
              resolvedSource = "jiosaavn";
              streamCache.set(ytId, {
                url: resolvedUrl,
                expires: Date.now() + 6 * 3600 * 1000,
              });
            }
          }
        } catch {}
      }

      if (!resolvedUrl) {
        // Fast instant response: instruct client to stream via Client-Side YouTube player directly on residential IP
        return NextResponse.json({
          success: true,
          source: "youtube",
          ytId,
          requiresClientPlayback: true,
        });
      }

      if (isJsonRequested) {
        const qualityInfo = resolveStreamQuality(resolvedUrl, resolvedSource);
        return NextResponse.json({
          success: true,
          audioUrl: resolvedUrl,
          ytId,
          source: resolvedSource,
          bitrate: qualityInfo.bitrate,
          qualityTier: qualityInfo.tier,
        });
      }

      return NextResponse.redirect(resolvedUrl, 302);
    }

    return NextResponse.json(
      { error: "Query parameter (ytId, q, or title) required" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Stream route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
